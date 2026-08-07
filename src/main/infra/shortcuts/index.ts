import { globalShortcut, type BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PlaybackCommand } from '@shared/ipc-contract'

/** Maps a playback command to the accelerator that was successfully registered. */
export type RegisteredShortcuts = Partial<Record<PlaybackCommand, string>>

interface CommandBinding {
  command: PlaybackCommand
  /** Hardware media key (headphones / keyboard play button), best UX. */
  mediaKey: string
  /** Software keyboard combos, tried in order; exposed for tooltip display. */
  softwareCandidates: string[]
}

/**
 * Global media-key shortcuts that work even when the app is unfocused.
 *
 * Each command registers BOTH a hardware media key (best for real use) and a
 * software keyboard combo (fallback + what tooltips display). Software combos
 * have several candidates because a single combo (e.g. Ctrl+Alt+P) may already
 * be owned by another app — we try candidates in order so one conflict doesn't
 * leave a command dead.
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

/** Currently registered software combo per command (for tooltip display). */
let registeredShortcuts: RegisteredShortcuts = {}

export function getRegisteredShortcuts(): RegisteredShortcuts {
  return { ...registeredShortcuts }
}

export function registerPlaybackShortcuts(getWindow: () => BrowserWindow | null): void {
  const send = (command: PlaybackCommand): void => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.playback.command, command)
  }

  registeredShortcuts = {}
  for (const { command, mediaKey, softwareCandidates } of COMMANDS) {
    // Hardware media key: register if free (non-fatal if owned elsewhere).
    globalShortcut.register(mediaKey, () => send(command))

    // Software combo: first successful candidate becomes the display shortcut.
    const registered = softwareCandidates.some((accelerator) => {
      const ok = globalShortcut.register(accelerator, () => send(command))
      if (ok) {
        registeredShortcuts[command] = accelerator
        console.log(`[shortcuts] registered ${command} via ${accelerator}`)
      }
      return ok
    })
    if (!registered) {
      console.warn(
        `[shortcuts] all software candidates failed for "${command}": ${softwareCandidates.join(', ')}`
      )
    }
  }
}

export function unregisterPlaybackShortcuts(): void {
  globalShortcut.unregisterAll()
  registeredShortcuts = {}
}
