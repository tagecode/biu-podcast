import { EpisodeRepository } from './episode.repository'
import { getDb } from '../../infra/db/client'
import { AppError } from '@shared/errors'
import type { EpisodeListPage } from '@shared/episode-list'
import type { Episode } from '@shared/types'

export class EpisodeService {
  private readonly db = getDb()
  private readonly episodes = new EpisodeRepository(this.db)

  listByPodcast(podcastId: string, offset = 0, limit = 50): EpisodeListPage {
    return this.episodes.listByPodcastPage(podcastId, offset, limit)
  }

  markAllPlayed(podcastId: string): number {
    return this.episodes.markAllPlayed(podcastId)
  }

  updateProgress(episodeId: string, positionSec: number): void {
    const episode = this.episodes.findById(episodeId)
    if (!episode) {
      throw new AppError('NOT_FOUND', '集数不存在')
    }
    this.episodes.updateProgress(episodeId, positionSec)
  }

  getLatest(podcastId: string): Episode | null {
    return this.episodes.findLatest(podcastId)
  }
}

export const episodeService = new EpisodeService()
