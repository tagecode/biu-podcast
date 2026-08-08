import i18n from '@/lib/i18n'
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
    MediaPlayPause: i18n.t('playback.accelPlayPause'),
    MediaNextTrack: i18n.t('playback.accelNextTrack'),
    MediaPreviousTrack: i18n.t('playback.accelPreviousTrack'),
    ArrowRight: '→',
    ArrowLeft: '←',
    Space: i18n.t('playback.accelSpace'),
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
