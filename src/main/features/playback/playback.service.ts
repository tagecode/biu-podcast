import { EpisodeRepository } from '../episode/episode.repository'
import { SubscriptionRepository } from '../subscription/subscription.repository'
import { getDb } from '../../infra/db/client'
import { settingsStore } from '../../infra/settings/store'
import { AppError } from '@shared/errors'
import type { Episode, PlaybackSession } from '@shared/types'

export class PlaybackService {
  private readonly db = getDb()
  private readonly episodes = new EpisodeRepository(this.db)
  private readonly subscriptions = new SubscriptionRepository(this.db)

  updateProgress(episodeId: string, positionSec: number): void {
    const episode = this.episodes.findById(episodeId)
    if (!episode) {
      throw new AppError('NOT_FOUND', '集数不存在')
    }
    this.episodes.updateProgress(episodeId, positionSec)
    this.subscriptions.findById(episode.podcastId)
    settingsStore.setLastSession(episodeId, episode.podcastId, positionSec)
  }

  getAdjacent(episodeId: string): { previous: Episode | null; next: Episode | null } {
    return this.episodes.findAdjacent(episodeId)
  }

  getLastSession(): PlaybackSession | null {
    const settings = settingsStore.getAll()
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
