import { createMediaSession } from './index'
import type { MediaSessionAdapter } from './types'
import type { MediaSessionUpdateInput } from './types'

let adapter: MediaSessionAdapter | null = null

/** Initialize the platform adapter (called once at app startup). */
export function initMediaSession(): MediaSessionAdapter {
  if (!adapter) {
    adapter = createMediaSession()
  }
  return adapter
}

/** Forward renderer-pushed playback state to the OS media center. */
export function updateMediaSession(info: MediaSessionUpdateInput): void {
  const current = adapter ?? initMediaSession()
  current.update(info)
}

/** Subscribe to media-center commands (play/pause/next/previous). */
export function onMediaSessionCommand(
  cb: (cmd: 'play' | 'pause' | 'next' | 'previous') => void
): () => void {
  const current = adapter ?? initMediaSession()
  return current.onCommand(cb)
}

/** Release the OS session at quit. */
export function disposeMediaSession(): void {
  adapter?.dispose()
  adapter = null
}
