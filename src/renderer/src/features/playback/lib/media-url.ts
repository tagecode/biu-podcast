import type { Episode } from '@shared/types'

/** Prefer local file via custom protocol when downloaded. */
export function resolveMediaUrl(episode: Episode): string {
  if (episode.isDownloaded && episode.localFilePath) {
    return `biu-media://local/?path=${encodeURIComponent(episode.localFilePath)}`
  }
  return episode.audioUrl
}
