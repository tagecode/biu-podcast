import { EpisodeRepository } from '../episode/episode.repository'
import { SubscriptionRepository } from '../subscription/subscription.repository'
import { getDb, type AppDatabase } from '../../infra/db/client'
import { settingsStore, SettingsStore } from '../../infra/settings/store'
import { AppError } from '@shared/errors'
import type { Episode, PlaybackSession } from '@shared/types'

export interface PlaybackServiceDeps {
  db?: AppDatabase
  settings?: SettingsStore
}

export class PlaybackService {
  private readonly episodes: EpisodeRepository
  private readonly subscriptions: SubscriptionRepository
  private readonly settings: SettingsStore

  constructor(deps: PlaybackServiceDeps = {}) {
    const db = deps.db ?? getDb()
    this.episodes = new EpisodeRepository(db)
    this.subscriptions = new SubscriptionRepository(db)
    this.settings = deps.settings ?? settingsStore
  }

  updateProgress(episodeId: string, positionSec: number): void {
    const episode = this.episodes.findById(episodeId)
    if (!episode) {
      throw new AppError('NOT_FOUND', '集数不存在')
    }
    this.episodes.updateProgress(episodeId, positionSec)
    this.subscriptions.findById(episode.podcastId)
    this.settings.setLastSession(episodeId, episode.podcastId, positionSec)
  }

  getAdjacent(episodeId: string): { previous: Episode | null; next: Episode | null } {
    return this.episodes.findAdjacent(episodeId)
  }

  getLastSession(): PlaybackSession | null {
    const settings = this.settings.getAll()
    if (!settings.lastEpisodeId || !settings.lastPodcastId) return null
    const episode = this.episodes.findById(settings.lastEpisodeId)
    const podcast = this.subscriptions.findById(settings.lastPodcastId)
    if (!episode || !podcast) return null
    return {
      episode: { ...episode, playbackPositionSec: settings.lastPositionSec },
      podcast,
      positionSec: settings.lastPositionSec
    }
  }
}

export const playbackService = new PlaybackService()
