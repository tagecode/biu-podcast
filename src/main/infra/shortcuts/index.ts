import { globalShortcut, type BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PlaybackCommand } from '@shared/ipc-contract'

/** Global media-key shortcuts that work even when the app is unfocused. */
export function registerPlaybackShortcuts(getWindow: () => BrowserWindow | null): void {
  const send = (command: PlaybackCommand): void => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.playback.command, command)
  }

  // Media keys (hardware play/pause/next/prev) are the standard global
  // controls; also offer Ctrl+Alt combos as a software fallback.
  const bindings: Array<{ accelerator: string; command: PlaybackCommand }> = [
    { accelerator: 'MediaPlayPause', command: 'toggle' },
    { accelerator: 'MediaNextTrack', command: 'next' },
    { accelerator: 'MediaPreviousTrack', command: 'previous' },
    { accelerator: 'CommandOrControl+Alt+P', command: 'toggle' },
    { accelerator: 'CommandOrControl+Alt+N', command: 'next' },
    { accelerator: 'CommandOrControl+Alt+B', command: 'previous' }
  ]

  for (const binding of bindings) {
    const ok = globalShortcut.register(binding.accelerator, () => send(binding.command))
    if (!ok) {
      // Another app may already own the media key; the software combos
      // (Ctrl/Cmd+Alt) are the reliable path. Non-fatal.
      console.warn(`Failed to register global shortcut: ${binding.accelerator}`)
    }
  }
}

export function unregisterPlaybackShortcuts(): void {
  globalShortcut.unregisterAll()
}
