import { EpisodeRepository } from './episode.repository'
import { parseChaptersJson } from './chapters'
import { getDb, type AppDatabase } from '../../infra/db/client'
import { sanitizeRichHtml } from '../../infra/sanitize/html'
import { AppError } from '@shared/errors'
import type { EpisodeListPage } from '@shared/episode-list'
import type { Chapter, Episode, EpisodeSearchHit } from '@shared/types'

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

  search(
    query: string,
    options: { downloadedOnly?: boolean; limit?: number } = {}
  ): EpisodeSearchHit[] {
    return this.episodes.search(query, options)
  }

  /**
   * Fetch and parse the episode's chapters JSON (podcast:chapters / psc).
   * Returns [] when the episode has no chapters ref or the fetch/parse fails —
   * chapters are additive and must never break playback.
   */
  async getChapters(episodeId: string): Promise<Chapter[]> {
    const episode = this.episodes.findById(episodeId)
    if (!episode) throw new AppError('NOT_FOUND', '集数不存在')
    const url = episode.chaptersUrl
    if (!url) return []

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'BiuPodcast/1.0 (+https://github.com/tagecode/biu-podcast)' }
        })
        if (!response.ok) return []
        return parseChaptersJson(await response.text())
      } finally {
        clearTimeout(timeout)
      }
    } catch {
      return []
    }
  }
}

export const episodeService = new EpisodeService()
