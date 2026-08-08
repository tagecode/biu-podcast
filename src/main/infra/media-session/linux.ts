import Player from 'mpris-service'
import type { MediaSessionAdapter } from './types'

/**
 * Linux MPRIS adapter (org.mpris.MediaPlayer2) backed by the pure-JS
 * `mpris-service` library (D-Bus via dbus-next, no native compilation).
 *
 * See mdocs/P1-13-Spike.md §3.2 for the Spike decision.
 */
export function createLinuxMprisAdapter(): MediaSessionAdapter {
  const player = Player({
    name: 'biu_podcast',
    identity: '博播 BiuPodcast',
    supportedUriSchemes: ['file', 'http', 'https'],
    supportedMimeTypes: ['audio/mpeg', 'application/ogg', 'audio/mp4', 'audio/aac'],
    supportedInterfaces: ['player']
  })

  // The OS media center may show enabled/disabled commands based on these.
  player.canControl = true
  player.canPlay = true
  player.canPause = true
  player.canGoNext = true
  player.canGoPrevious = true

  let currentTrackId: string | null = null

  return {
    update(info) {
      if (!currentTrackId) {
        currentTrackId = player.objectPath('track/0')
      }
      const metadata: Record<string, unknown> = {
        'mpris:trackid': currentTrackId,
        'xesam:title': info.title,
        'xesam:artist': [info.artist],
        'xesam:album': info.artist
      }
      if (info.durationSec != null && info.durationSec > 0) {
        metadata['mpris:length'] = Math.round(info.durationSec * 1_000_000)
      }
      if (info.artworkUrl) {
        metadata['mpris:artUrl'] = info.artworkUrl
      }
      player.metadata = metadata
      player.playbackStatus = info.playing ? 'Playing' : 'Paused'
      // Keep the seek bar truthful (MPRIS position is in microseconds).
      if (info.positionSec > 0) {
        player.seeked(Math.round(info.positionSec * 1_000_000))
      }
    },

    onCommand(cb) {
      const dispatch = (cmd: 'play' | 'pause' | 'next' | 'previous'): void => cb(cmd)
      player.on('play', () => dispatch('play'))
      player.on('pause', () => dispatch('pause'))
      player.on('playpause', () => dispatch('play'))
      player.on('next', () => dispatch('next'))
      player.on('previous', () => dispatch('previous'))
      return () => player.removeAllListeners()
    },

    dispose() {
      player.removeAllListeners()
      // Unpublish the bus name; mpris-service has no public stop(), so remove
      // listeners and let the session-bus name drop when the process exits.
    }
  }
}
