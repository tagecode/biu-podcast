import type { MediaSessionUpdate } from '@shared/ipc-contract'

/**
 * Platform-neutral contract for the OS media session integration
 * (Windows SMTC / macOS Now Playing / Linux MPRIS). See mdocs/P1-13-Spike.md.
 *
 * `Playback Service` only programs against this interface; concrete adapters
 * are chosen by `createMediaSession()` based on `process.platform`.
 */
export interface MediaSessionAdapter {
  /** Push metadata + playback state to the OS media center. */
  update(info: MediaSessionUpdate): void
  /**
   * Subscribe to media-center commands. Returns an unsubscribe function.
   * Commands map to the same routing as global shortcuts (`playback:command`).
   */
  onCommand(cb: (cmd: 'play' | 'pause' | 'next' | 'previous') => void): () => void
  /** Release the OS session (app quit). */
  dispose(): void
}

export type MediaSessionUpdateInput = MediaSessionUpdate
