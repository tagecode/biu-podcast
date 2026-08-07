import { globalShortcut, type BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PlaybackCommand } from '@shared/ipc-contract'

interface CommandBinding {
  command: PlaybackCommand
  /** Candidate accelerators, tried in order; first successful wins. */
  candidates: string[]
}

/**
 * Global media-key shortcuts that work even when the app is unfocused.
 *
 * Media keys (hardware play/pause/next/prev) are the primary path. Software
 * combos are fallbacks with several candidates each, because a single combo
 * (e.g. Ctrl+Alt+P) may already be owned by another app — we try candidates
 * in order so one conflict doesn't leave a command dead.
 */
const COMMANDS: CommandBinding[] = [
  {
    command: 'toggle',
    candidates: ['MediaPlayPause', 'CommandOrControl+Alt+P', 'CommandOrControl+Alt+Space']
  },
  {
    command: 'next',
    candidates: ['MediaNextTrack', 'CommandOrControl+Alt+N', 'CommandOrControl+Shift+Right']
  },
  {
    command: 'previous',
    candidates: ['MediaPreviousTrack', 'CommandOrControl+Alt+B', 'CommandOrControl+Shift+Left']
  }
]

export function registerPlaybackShortcuts(getWindow: () => BrowserWindow | null): void {
  const send = (command: PlaybackCommand): void => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.playback.command, command)
  }

  for (const { command, candidates } of COMMANDS) {
    const registered = candidates.some((accelerator) => {
      const ok = globalShortcut.register(accelerator, () => send(command))
      if (ok) {
        console.log(`[shortcuts] registered ${command} via ${accelerator}`)
      }
      return ok
    })
    if (!registered) {
      console.warn(`[shortcuts] all candidates failed for "${command}": ${candidates.join(', ')}`)
    }
  }
}

export function unregisterPlaybackShortcuts(): void {
  globalShortcut.unregisterAll()
}
