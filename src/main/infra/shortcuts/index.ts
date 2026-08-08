import { globalShortcut, type BrowserWindow } from 'electron'

import { AppError } from '@shared/errors'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  RegisteredShortcuts,
  ShortcutCommand,
  ShortcutConfig,
  ShortcutSetResult
} from '@shared/ipc-contract'
import { settingsStore } from '../settings/store'

interface CommandBinding {
  command: ShortcutCommand
  /** Hardware media key (headphones / keyboard play button), best UX. */
  mediaKey: string
  /**
   * Software keyboard combos, tried in order; the first one is the default
   * accelerator. User overrides replace the first try, but a taken override
   * still falls back through this list so the command never goes dead.
   */
  softwareCandidates: string[]
}

/**
 * Global media-key shortcuts that work even when the app is unfocused.
 *
 * Each command registers BOTH a hardware media key (best for real use) and a
 * software keyboard combo (fallback + what tooltips display). Software combos
 * have several candidates because a single combo (e.g. Ctrl+Alt+P) may already
 * be owned by another app — we try candidates in order so one conflict doesn't
 * leave a command dead. Users can override the primary software combo via the
 * settings page (P1-15b); overrides are persisted in `settings.shortcutBindings`.
 */
const COMMANDS: CommandBinding[] = [
  {
    command: 'toggle',
    mediaKey: 'MediaPlayPause',
    softwareCandidates: ['CommandOrControl+Alt+P', 'CommandOrControl+Alt+Space']
  },
  {
    command: 'next',
    mediaKey: 'MediaNextTrack',
    softwareCandidates: ['CommandOrControl+Alt+N', 'CommandOrControl+Shift+Right']
  },
  {
    command: 'previous',
    mediaKey: 'MediaPreviousTrack',
    softwareCandidates: ['CommandOrControl+Alt+B', 'CommandOrControl+Shift+Left']
  }
]

/** Default primary software combo per command (first candidate). */
const DEFAULT_ACCELERATORS = Object.fromEntries(
  COMMANDS.map(({ command, softwareCandidates }) => [command, softwareCandidates[0]])
) as Record<ShortcutCommand, string>

/** Currently registered software combo per command (for tooltip display). */
let registeredShortcuts: RegisteredShortcuts = {}

/** Window provider set at startup; used to route commands + broadcast. */
let getWindow: () => BrowserWindow | null = () => null

export function getRegisteredShortcuts(): RegisteredShortcuts {
  return { ...registeredShortcuts }
}

/** Effective accelerator for a command: user override, else the default. */
function effectiveAccelerator(command: ShortcutCommand): string {
  const user = settingsStore.get('shortcutBindings')[command]
  return user ?? DEFAULT_ACCELERATORS[command]
}

export function getShortcutConfig(): ShortcutConfig {
  return {
    custom: { ...settingsStore.get('shortcutBindings') },
    defaults: { ...DEFAULT_ACCELERATORS }
  }
}

function send(command: ShortcutCommand): void {
  const window = getWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send(IPC_CHANNELS.playback.command, command)
}

function broadcastApplied(command: ShortcutCommand, result: ShortcutSetResult): void {
  const window = getWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send(IPC_CHANNELS.shortcuts.applied, { command, ...result })
}

/**
 * Register one command's shortcuts. The software combo tries the user override
 * first (if any), then the candidate list, so a taken override degrades to the
 * next candidate instead of killing the command. Returns what actually stuck.
 */
function registerCommand({
  command,
  mediaKey,
  softwareCandidates
}: CommandBinding): ShortcutSetResult {
  // Hardware media key: register if free (non-fatal if owned elsewhere).
  globalShortcut.register(mediaKey, () => send(command))

  const userBinding = settingsStore.get('shortcutBindings')[command]
  const candidates = userBinding ? [userBinding, ...softwareCandidates] : softwareCandidates

  let taken = false
  const registered = candidates.some((accelerator) => {
    const ok = globalShortcut.register(accelerator, () => send(command))
    if (ok) {
      registeredShortcuts[command] = accelerator
      console.log(`[shortcuts] registered ${command} via ${accelerator}`)
    } else if (accelerator === userBinding) {
      // The user's chosen combo is owned by another app.
      taken = true
    }
    return ok
  })
  if (!registered) {
    console.warn(
      `[shortcuts] all software candidates failed for "${command}": ${candidates.join(', ')}`
    )
    return { registered: null }
  }
  return { registered: registeredShortcuts[command] ?? null, taken: taken || undefined }
}

/** Re-register every command from persisted settings (startup + after a change). */
function applyAll(): Partial<Record<ShortcutCommand, ShortcutSetResult>> {
  registeredShortcuts = {}
  globalShortcut.unregisterAll()
  const results: Partial<Record<ShortcutCommand, ShortcutSetResult>> = {}
  for (const binding of COMMANDS) {
    results[binding.command] = registerCommand(binding)
  }
  return results
}

/**
 * Save a user binding for one command and re-register. Rejects duplicates
 * across commands up-front; if the new combo is owned by another app, reverts
 * to the previous config and reports `taken` so the UI can notify.
 */
export function applyShortcutBinding(
  command: ShortcutCommand,
  accelerator: string | null
): ShortcutSetResult {
  if (accelerator) {
    const duplicate = COMMANDS.some(
      ({ command: other }) => other !== command && effectiveAccelerator(other) === accelerator
    )
    if (duplicate) {
      throw new AppError('SHORTCUT_CONFLICT', '该快捷键已绑定到其他命令')
    }
  }

  const bindings = { ...settingsStore.get('shortcutBindings') }
  const previous = bindings[command]
  if (accelerator == null) {
    delete bindings[command]
  } else {
    bindings[command] = accelerator
  }
  settingsStore.set('shortcutBindings', bindings)

  const results = applyAll()
  const result = results[command]

  // The user's combo lost to another app — revert config + registration.
  if (accelerator != null && result?.registered !== accelerator) {
    const reverted = { ...bindings }
    if (previous == null) {
      delete reverted[command]
    } else {
      reverted[command] = previous
    }
    settingsStore.set('shortcutBindings', reverted)
    const applied = applyAll()[command]
    const revertedResult: ShortcutSetResult = {
      registered: applied?.registered ?? null,
      taken: true
    }
    broadcastApplied(command, revertedResult)
    return revertedResult
  }

  const out: ShortcutSetResult = {
    registered: result?.registered ?? null,
    taken: result?.taken
  }
  broadcastApplied(command, out)
  return out
}

export function registerPlaybackShortcuts(windowProvider: () => BrowserWindow | null): void {
  getWindow = windowProvider
  applyAll()
}

export function unregisterPlaybackShortcuts(): void {
  globalShortcut.unregisterAll()
  registeredShortcuts = {}
  getWindow = () => null
}
