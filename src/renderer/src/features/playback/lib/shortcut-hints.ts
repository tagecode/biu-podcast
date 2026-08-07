import type { RegisteredShortcuts } from '@shared/ipc-contract'

/** Format an Electron accelerator for display in tooltips. */
export function formatAccelerator(accel: string | undefined): string | null {
  if (!accel) return null
  const map: Record<string, string> = {
    CommandOrControl: 'Ctrl',
    Control: 'Ctrl',
    Command: '⌘',
    Alt: 'Alt',
    Shift: 'Shift',
    MediaPlayPause: '播放/暂停键',
    MediaNextTrack: '下一曲键',
    MediaPreviousTrack: '上一曲键',
    ArrowRight: '→',
    ArrowLeft: '←',
    Space: '空格',
    Right: '→',
    Left: '←'
  }
  return accel
    .split('+')
    .map((part) => map[part] ?? part)
    .join(' + ')
}

/** Fetch the accelerators actually registered for each playback command. */
export async function fetchRegisteredShortcuts(): Promise<RegisteredShortcuts> {
  const result = await window.api.playback.getRegisteredShortcuts()
  return result.ok ? result.data : {}
}
