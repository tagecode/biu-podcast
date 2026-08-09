import { EpisodeRepository } from '../episode/episode.repository'
import { getDb, type AppDatabase } from '../../infra/db/client'
import type { Episode, PlaybackQueue } from '@shared/types'

import { QueueRepository } from './queue.repository'

export interface QueueServiceDeps {
  db?: AppDatabase
}

/**
 * Load the persisted playback queue together with the full Episode objects in
 * queue order, so the renderer can restore its queue in one round trip
 * (mirrors how getLastSession returns full episode + podcast objects).
 */
export class QueueService {
  private readonly queue: QueueRepository
  private readonly episodes: EpisodeRepository

  constructor(deps: QueueServiceDeps = {}) {
    const db = deps.db ?? getDb()
    this.queue = new QueueRepository(db)
    this.episodes = new EpisodeRepository(db)
  }

  load(): { queue: PlaybackQueue; episodes: Episode[] } | null {
    const queue = this.queue.load()
    if (!queue || queue.episodeIds.length === 0) return null
    const episodes = queue.episodeIds
      .map((id) => this.episodes.findById(id))
      .filter((e): e is Episode => e !== null)
    return { queue, episodes }
  }

  save(
    episodeIds: string[],
    mode: PlaybackQueue['mode'],
    currentEpisodeId: string | null
  ): PlaybackQueue {
    return this.queue.save({ episodeIds, mode, currentEpisodeId })
  }
}

export const queueService = new QueueService()
