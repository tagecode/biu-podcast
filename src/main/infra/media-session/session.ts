import { setDockMenuState } from '../dock'
import { createMediaSession } from './index'
import type { MediaSessionAdapter } from './types'
import type { MediaSessionUpdateInput } from './types'

let adapter: MediaSessionAdapter | null = null
let lastInfo: MediaSessionUpdateInput | null = null

/** Initialize the platform adapter (called once at app startup). */
export function initMediaSession(): MediaSessionAdapter {
  if (!adapter) {
    adapter = createMediaSession()
  }
  return adapter
}

/** Forward renderer-pushed playback state to the OS media center. */
export function updateMediaSession(info: MediaSessionUpdateInput): void {
  lastInfo = info
  const current = adapter ?? initMediaSession()
  current.update(info)
  setDockMenuState({
    title: info.title,
    artist: info.artist,
    positionSec: info.positionSec,
    playing: info.playing
  })
}

/** Last playback info pushed to the OS media session (used by Dock rebuild). */
export function getMediaSessionSnapshot(): MediaSessionUpdateInput | null {
  return lastInfo
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
  lastInfo = null
}
