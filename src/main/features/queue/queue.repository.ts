import { eq } from 'drizzle-orm'

import type { AppDatabase } from '../../infra/db/client'
import { episodes, playbackQueue } from '../../infra/db/schema'
import type { PlaybackQueue, QueueMode } from '@shared/types'

/** Single-row table; this is the only row. */
const QUEUE_ROW_ID = 'current'

/**
 * Repository for the persisted playback queue (PRD §5.2「播放队列持久化」).
 * The queue is a single JSON row so the current order, mode, and playing
 * episode survive app restarts without new per-item rows.
 */
export class QueueRepository {
  constructor(private readonly db: AppDatabase) {}

  load(): PlaybackQueue | null {
    const row = this.db.select().from(playbackQueue).where(eq(playbackQueue.id, QUEUE_ROW_ID)).get()
    if (!row) return null
    return {
      episodeIds: safeParseJsonArray(row.episodeIds),
      mode: row.mode as QueueMode,
      currentEpisodeId: row.currentEpisodeId
    }
  }

  /** Save the queue, pruning episode ids that no longer exist in episodes. */
  save(queue: PlaybackQueue): PlaybackQueue {
    const existingIds = new Set(
      this.db
        .select({ id: playbackQueue.id })
        .from(playbackQueue)
        .all()
        .map((row) => row.id)
    )
    // Prune ids whose episode was deleted (unsubscribed podcast, etc.).
    const episodeIds = queue.episodeIds.filter((id) => this.episodeExists(id))
    const currentEpisodeId =
      queue.currentEpisodeId && episodeIds.includes(queue.currentEpisodeId)
        ? queue.currentEpisodeId
        : null

    if (existingIds.has(QUEUE_ROW_ID)) {
      this.db
        .update(playbackQueue)
        .set({
          episodeIds: JSON.stringify(episodeIds),
          mode: queue.mode,
          currentEpisodeId,
          updatedAt: Date.now()
        })
        .where(eq(playbackQueue.id, QUEUE_ROW_ID))
        .run()
    } else {
      this.db
        .insert(playbackQueue)
        .values({
          id: QUEUE_ROW_ID,
          episodeIds: JSON.stringify(episodeIds),
          mode: queue.mode,
          currentEpisodeId,
          updatedAt: Date.now()
        })
        .run()
    }
    return { episodeIds, mode: queue.mode, currentEpisodeId }
  }

  clear(): void {
    this.db.delete(playbackQueue).where(eq(playbackQueue.id, QUEUE_ROW_ID)).run()
  }

  private episodeExists(episodeId: string): boolean {
    return Boolean(
      this.db.select({ id: episodes.id }).from(episodes).where(eq(episodes.id, episodeId)).get()
    )
  }
}

function safeParseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
