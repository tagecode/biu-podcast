import type { EpisodeListPage } from '@shared/episode-list'
import { EPISODE_PAGE_SIZE } from '@shared/episode-list'
import type { Chapter, Episode } from '@shared/types'

export async function listEpisodesPage(
  podcastId: string,
  offset = 0,
  limit = EPISODE_PAGE_SIZE
): Promise<EpisodeListPage> {
  const result = await window.api.episode.listByPodcast({ podcastId, offset, limit })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function getEpisode(episodeId: string): Promise<Episode> {
  const result = await window.api.episode.getById({ episodeId })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function getChapters(episodeId: string): Promise<Chapter[]> {
  const result = await window.api.episode.getChapters({ episodeId })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function markAllPlayed(podcastId: string): Promise<number> {
  const result = await window.api.episode.markAllPlayed({ podcastId })
  if (!result.ok) throw new Error(result.error.message)
  return result.data.updated
}
