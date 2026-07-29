import { eq, isNull, sql } from 'drizzle-orm'

import type { AppDatabase } from '../../infra/db/client'
import { episodes, podcasts } from '../../infra/db/schema'
import type { FetchStatus, Podcast } from '@shared/types'

export function normalizeFeedUrl(feedUrl: string): string {
  const trimmed = feedUrl.trim()
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  return withoutTrailingSlash.toLowerCase()
}

export class SubscriptionRepository {
  constructor(private readonly db: AppDatabase) {}

  insertPodcast(input: {
    id: string
    feedUrl: string
    title: string
    description: string | null
    coverUrl: string | null
    author: string | null
    language: string | null
    subscribedAt: number
    lastFetchedAt: number
    lastFetchStatus: FetchStatus
  }): void {
    this.db
      .insert(podcasts)
      .values({
        ...input,
        unsubscribedAt: null
      })
      .run()
  }

  findByFeedUrl(feedUrl: string): Podcast | null {
    const normalized = normalizeFeedUrl(feedUrl)
    const rows = this.db.select().from(podcasts).where(isNull(podcasts.unsubscribedAt)).all()
    const row = rows.find((item) => normalizeFeedUrl(item.feedUrl) === normalized)
    return row ? this.toPodcast(row) : null
  }

  findById(id: string): Podcast | null {
    const row = this.db.select().from(podcasts).where(eq(podcasts.id, id)).get()
    return row ? this.toPodcast(row) : null
  }

  listWithUnreadCount(): Podcast[] {
    const rows = this.db
      .select({
        podcast: podcasts,
        unreadCount: sql<number>`sum(case when ${episodes.isPlayed} = 0 then 1 else 0 end)`
      })
      .from(podcasts)
      .leftJoin(episodes, eq(episodes.podcastId, podcasts.id))
      .where(isNull(podcasts.unsubscribedAt))
      .groupBy(podcasts.id)
      .all()

    return rows.map(({ podcast, unreadCount }) => ({
      ...this.toPodcast(podcast),
      unreadCount: Number(unreadCount ?? 0)
    }))
  }

  updatePodcastMeta(
    id: string,
    input: {
      title: string
      description: string | null
      coverUrl: string | null
      author: string | null
      language: string | null
      lastFetchedAt: number
      lastFetchStatus: FetchStatus
    }
  ): void {
    this.db.update(podcasts).set(input).where(eq(podcasts.id, id)).run()
  }

  softUnsubscribe(id: string): void {
    this.db.update(podcasts).set({ unsubscribedAt: Date.now() }).where(eq(podcasts.id, id)).run()
  }

  deletePodcast(id: string): void {
    this.db.delete(podcasts).where(eq(podcasts.id, id)).run()
  }

  private toPodcast(row: typeof podcasts.$inferSelect): Podcast {
    return {
      id: row.id,
      feedUrl: row.feedUrl,
      title: row.title,
      description: row.description,
      coverUrl: row.coverUrl,
      author: row.author,
      language: row.language,
      isPaused: row.isPaused,
      subscribedAt: row.subscribedAt,
      lastFetchedAt: row.lastFetchedAt,
      lastFetchStatus: row.lastFetchStatus as FetchStatus | null
    }
  }
}
