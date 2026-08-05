import { EpisodeRepository } from './episode.repository'
import { getDb, type AppDatabase } from '../../infra/db/client'
import { sanitizeRichHtml } from '../../infra/sanitize/html'
import { AppError } from '@shared/errors'
import type { EpisodeListPage } from '@shared/episode-list'
import type { Episode } from '@shared/types'

export interface EpisodeServiceDeps {
  db?: AppDatabase
}

export class EpisodeService {
  private readonly episodes: EpisodeRepository

  constructor(deps: EpisodeServiceDeps = {}) {
    const db = deps.db ?? getDb()
    this.episodes = new EpisodeRepository(db)
  }

  listByPodcast(podcastId: string, offset = 0, limit = 50): EpisodeListPage {
    return this.episodes.listByPodcastPage(podcastId, offset, limit)
  }

  getById(episodeId: string): Episode {
    const episode = this.episodes.findById(episodeId)
    if (!episode) {
      throw new AppError('NOT_FOUND', '集数不存在')
    }
    return {
      ...episode,
      descriptionHtml: sanitizeRichHtml(episode.descriptionHtml)
    }
  }

  markAllPlayed(podcastId: string): number {
    return this.episodes.markAllPlayed(podcastId)
  }

  markPlayed(episodeId: string): boolean {
    const episode = this.episodes.findById(episodeId)
    if (!episode) {
      throw new AppError('NOT_FOUND', '集数不存在')
    }
    return this.episodes.markPlayed(episodeId)
  }

  /** Like markPlayed but returns the podcastId for unread-count refresh. */
  markPlayedWithPodcast(episodeId: string): { changed: boolean; podcastId: string } {
    const episode = this.episodes.findById(episodeId)
    if (!episode) {
      throw new AppError('NOT_FOUND', '集数不存在')
    }
    const changed = this.episodes.markPlayed(episodeId)
    return { changed, podcastId: episode.podcastId }
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
