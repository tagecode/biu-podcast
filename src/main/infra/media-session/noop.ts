import type { MediaSessionAdapter } from './types'

/**
 * No-op adapter: used on platforms without an implementation yet (currently
 * macOS until the native module ships) and in dev builds. Keeps the app
 * functional everywhere — the OS media center is purely additive.
 */
export const noopMediaSession: MediaSessionAdapter = {
  update() {
    /* no-op */
  },
  onCommand() {
    return () => undefined
  },
  dispose() {
    /* no-op */
  }
}
