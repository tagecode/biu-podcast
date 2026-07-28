import type { Episode } from '@shared/types'

export async function listEpisodes(podcastId: string): Promise<Episode[]> {
  const result = await window.api.episode.listByPodcast({ podcastId })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function markAllPlayed(podcastId: string): Promise<number> {
  const result = await window.api.episode.markAllPlayed({ podcastId })
  if (!result.ok) throw new Error(result.error.message)
  return result.data.updated
}
