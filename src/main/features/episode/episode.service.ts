import { EpisodeRepository } from './episode.repository'
import { getDb } from '../../infra/db/client'
import { AppError } from '@shared/errors'
import type { Episode } from '@shared/types'

export class EpisodeService {
  private readonly db = getDb()
  private readonly episodes = new EpisodeRepository(this.db)

  listByPodcast(podcastId: string): Episode[] {
    return this.episodes.listByPodcast(podcastId)
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
}

export const episodeService = new EpisodeService()
