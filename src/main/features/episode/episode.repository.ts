import { and, desc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import type { AppDatabase } from '../../infra/db/client'
import { episodes } from '../../infra/db/schema'
import type { Episode, ParsedFeedEpisode } from '@shared/types'

export class EpisodeRepository {
  constructor(private readonly db: AppDatabase) {}

  insertMany(podcastId: string, items: ParsedFeedEpisode[]): number {
    let inserted = 0
    for (const item of items) {
      const exists = this.findExisting(podcastId, item)
      if (exists) continue
      this.db
        .insert(episodes)
        .values({
          id: ulid(),
          podcastId,
          guid: item.guid,
          title: item.title,
          descriptionHtml: item.descriptionHtml,
          publishedAt: item.publishedAt,
          audioUrl: item.audioUrl,
          durationSec: item.durationSec,
          fileSizeBytes: item.fileSizeBytes,
          isPlayed: false,
          playbackPositionSec: 0,
          isDownloaded: false
        })
        .run()
      inserted += 1
    }
    return inserted
  }

  listByPodcast(podcastId: string): Episode[] {
    const rows = this.db
      .select()
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .orderBy(desc(episodes.publishedAt))
      .all()
    return rows.map((row) => this.toEpisode(row))
  }

  markAllPlayed(podcastId: string): number {
    const result = this.db
      .update(episodes)
      .set({ isPlayed: true })
      .where(and(eq(episodes.podcastId, podcastId), eq(episodes.isPlayed, false)))
      .run()
    return result.changes
  }

  countUnread(podcastId: string): number {
    const rows = this.db
      .select()
      .from(episodes)
      .where(and(eq(episodes.podcastId, podcastId), eq(episodes.isPlayed, false)))
      .all()
    return rows.length
  }

  updateProgress(episodeId: string, positionSec: number): void {
    this.db
      .update(episodes)
      .set({ playbackPositionSec: positionSec })
      .where(eq(episodes.id, episodeId))
      .run()
  }

  findById(episodeId: string): Episode | null {
    const row = this.db.select().from(episodes).where(eq(episodes.id, episodeId)).get()
    return row ? this.toEpisode(row) : null
  }

  private findExisting(podcastId: string, item: ParsedFeedEpisode): boolean {
    const rows = this.db.select().from(episodes).where(eq(episodes.podcastId, podcastId)).all()
    return rows.some(
      (row) =>
        (item.guid && row.guid === item.guid) ||
        row.audioUrl === item.audioUrl ||
        (row.title === item.title && row.publishedAt === item.publishedAt)
    )
  }

  private toEpisode(row: typeof episodes.$inferSelect): Episode {
    return {
      id: row.id,
      podcastId: row.podcastId,
      title: row.title,
      descriptionHtml: row.descriptionHtml,
      publishedAt: row.publishedAt,
      audioUrl: row.audioUrl,
      durationSec: row.durationSec,
      fileSizeBytes: row.fileSizeBytes,
      isPlayed: row.isPlayed,
      playbackPositionSec: row.playbackPositionSec,
      isDownloaded: row.isDownloaded,
      localFilePath: row.localFilePath,
      downloadStatus: row.downloadStatus as Episode['downloadStatus'],
      downloadedAt: row.downloadedAt,
      guid: row.guid
    }
  }
}
