import type { Episode, Podcast } from '@shared/types'

import { notifyCopied } from '@/lib/copied-feedback'

export function podcastShareUrl(podcast: Podcast): string {
  return podcast.feedUrl
}

export function episodeShareUrl(episode: Episode): string {
  if (episode.link) return episode.link
  if (episode.guid && /^https?:\/\//i.test(episode.guid) && episode.guid !== episode.audioUrl) {
    return episode.guid
  }
  return episode.audioUrl
}

export async function copyShareUrl(text: string): Promise<void> {
  const result = await window.api.clipboard.writeText(text)
  if (!result.ok) throw new Error(result.error.message)
  notifyCopied()
}
