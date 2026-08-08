import { createLinuxMprisAdapter } from './linux'
import { noopMediaSession } from './noop'
import type { MediaSessionAdapter } from './types'
import { createWinSmtcAdapter } from './win'

/**
 * Create the OS media-session adapter for the current platform.
 *
 * - Linux: MPRIS via mpris-service (pure JS, D-Bus)
 * - Windows: SMTC via a .NET companion process (win-smtc.ts)
 * - macOS: noop until the Node-API module ships (Spike §3.4)
 *
 * In dev builds we also return noop on Linux/Windows if their bridge can't be
 * started, so a missing system component never breaks the app — the media
 * center is purely additive. See mdocs/P1-13-Spike.md.
 */
export function createMediaSession(): MediaSessionAdapter {
  try {
    if (process.platform === 'linux') {
      return createLinuxMprisAdapter()
    }
    if (process.platform === 'win32') {
      return createWinSmtcAdapter()
    }
    return noopMediaSession
  } catch (error) {
    console.error('[media-session] failed to create adapter, using noop:', error)
    return noopMediaSession
  }
}
