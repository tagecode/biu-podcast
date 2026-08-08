declare module 'mpris-service' {
  interface MprisPlayerOptions {
    name: string
    identity: string
    supportedUriSchemes?: string[]
    supportedMimeTypes?: string[]
    supportedInterfaces?: string[]
    desktopEntry?: string
  }

  interface MprisPlayer {
    metadata: Record<string, unknown>
    playbackStatus: 'Playing' | 'Paused' | 'Stopped'
    canControl: boolean
    canPlay: boolean
    canPause: boolean
    canGoNext: boolean
    canGoPrevious: boolean
    identity: string
    objectPath(subpath: string): string
    on(event: string, cb: (...args: unknown[]) => void): this
    removeAllListeners(event?: string): this
    /** Emit a track-seeked position update (microseconds). */
    seeked(positionUs: number): void
    /** Default no-op; override to report the current position. */
    getPosition(): number
  }

  interface MprisServiceModule {
    (options: MprisPlayerOptions): MprisPlayer
  }

  const Player: MprisServiceModule
  export default Player
}
