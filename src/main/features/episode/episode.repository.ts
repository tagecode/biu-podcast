import { and, count, desc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import type { AppDatabase } from '../../infra/db/client'
import { episodes } from '../../infra/db/schema'
import type { EpisodeListPage } from '@shared/episode-list'
import type { Episode, ParsedFeedEpisode } from '@shared/types'

const INSERT_CHUNK_SIZE = 200
const DESCRIPTION_MAX_CHARS = 4000

function truncateDescription(html: string | null): string | null {
  if (!html) return null
  if (html.length <= DESCRIPTION_MAX_CHARS) return html
  return `${html.slice(0, DESCRIPTION_MAX_CHARS)}…`
}

function episodeKey(guid: string | null | undefined, audioUrl: string): string {
  return guid ? `g:${guid}` : `a:${audioUrl}`
}

export class EpisodeRepository {
  constructor(private readonly db: AppDatabase) {}

  insertMany(podcastId: string, items: ParsedFeedEpisode[]): number {
    if (items.length === 0) return 0

    const existing = this.db
      .select({
        guid: episodes.guid,
        audioUrl: episodes.audioUrl
      })
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .all()

    const known = new Set(existing.map((row) => episodeKey(row.guid, row.audioUrl)))

    const rows: Array<{
      id: string
      podcastId: string
      guid: string | null
      title: string
      descriptionHtml: string | null
      publishedAt: number
      audioUrl: string
      durationSec: number | null
      fileSizeBytes: number | null
      isPlayed: boolean
      playbackPositionSec: number
      isDownloaded: boolean
    }> = []
    for (const item of items) {
      const key = episodeKey(item.guid, item.audioUrl)
      if (known.has(key)) continue
      known.add(key)
      rows.push({
        id: ulid(),
        podcastId,
        guid: item.guid,
        title: item.title,
        descriptionHtml: truncateDescription(item.descriptionHtml),
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        durationSec: item.durationSec,
        fileSizeBytes: item.fileSizeBytes,
        isPlayed: false,
        playbackPositionSec: 0,
        isDownloaded: false
      })
    }

    if (rows.length === 0) return 0

    this.db.transaction((tx) => {
      for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE)
        for (const row of chunk) {
          tx.insert(episodes).values(row).run()
        }
      }
    })

    return rows.length
  }

  listByPodcastPage(podcastId: string, offset = 0, limit = 50): EpisodeListPage {
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const safeOffset = Math.max(offset, 0)

    const totalRow = this.db
      .select({ value: count() })
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .get()

    const unreadRow = this.db
      .select({ value: count() })
      .from(episodes)
      .where(and(eq(episodes.podcastId, podcastId), eq(episodes.isPlayed, false)))
      .get()

    const total = Number(totalRow?.value ?? 0)
    const unreadCount = Number(unreadRow?.value ?? 0)

    const rows = this.db
      .select({
        id: episodes.id,
        podcastId: episodes.podcastId,
        guid: episodes.guid,
        title: episodes.title,
        publishedAt: episodes.publishedAt,
        audioUrl: episodes.audioUrl,
        durationSec: episodes.durationSec,
        fileSizeBytes: episodes.fileSizeBytes,
        isPlayed: episodes.isPlayed,
        playbackPositionSec: episodes.playbackPositionSec,
        isDownloaded: episodes.isDownloaded,
        localFilePath: episodes.localFilePath,
        downloadStatus: episodes.downloadStatus,
        downloadedAt: episodes.downloadedAt
      })
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .orderBy(desc(episodes.publishedAt), desc(episodes.id))
      .limit(safeLimit)
      .offset(safeOffset)
      .all()

    const items: Episode[] = rows.map((row) => ({
      id: row.id,
      podcastId: row.podcastId,
      title: row.title,
      descriptionHtml: null,
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
    }))

    return {
      items,
      total,
      unreadCount,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset + items.length < total
    }
  }

  markAllPlayed(podcastId: string): number {
    const result = this.db
      .update(episodes)
      .set({ isPlayed: true })
      .where(and(eq(episodes.podcastId, podcastId), eq(episodes.isPlayed, false)))
      .run()
    return result.changes
  }

  /** Mark a single episode as played (idempotent: only if currently unplayed). */
  markPlayed(episodeId: string): boolean {
    const result = this.db
      .update(episodes)
      .set({ isPlayed: true })
      .where(and(eq(episodes.id, episodeId), eq(episodes.isPlayed, false)))
      .run()
    return result.changes > 0
  }

  countUnread(podcastId: string): number {
    const row = this.db
      .select({ value: count() })
      .from(episodes)
      .where(and(eq(episodes.podcastId, podcastId), eq(episodes.isPlayed, false)))
      .get()
    return Number(row?.value ?? 0)
  }

  countByPodcast(podcastId: string): number {
    const row = this.db
      .select({ value: count() })
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .get()
    return Number(row?.value ?? 0)
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

  findLatest(podcastId: string): Episode | null {
    const row = this.db
      .select()
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .orderBy(desc(episodes.publishedAt), desc(episodes.id))
      .limit(1)
      .get()
    return row ? this.toEpisode(row) : null
  }

  /** Newest-first ordering: previous = newer, next = older. */
  findAdjacent(episodeId: string): { previous: Episode | null; next: Episode | null } {
    const current = this.findById(episodeId)
    if (!current) return { previous: null, next: null }

    const ordered = this.db
      .select()
      .from(episodes)
      .where(eq(episodes.podcastId, current.podcastId))
      .orderBy(desc(episodes.publishedAt), desc(episodes.id))
      .all()
      .map((row) => this.toEpisode(row))

    const index = ordered.findIndex((item) => item.id === episodeId)
    if (index < 0) return { previous: null, next: null }
    return {
      previous: index > 0 ? ordered[index - 1] : null,
      next: index < ordered.length - 1 ? ordered[index + 1] : null
    }
  }

  markDownloaded(episodeId: string, localFilePath: string): void {
    this.db
      .update(episodes)
      .set({
        isDownloaded: true,
        localFilePath,
        downloadStatus: 'completed',
        downloadedAt: Date.now()
      })
      .where(eq(episodes.id, episodeId))
      .run()
  }

  setDownloadStatus(episodeId: string, status: Episode['downloadStatus']): void {
    this.db.update(episodes).set({ downloadStatus: status }).where(eq(episodes.id, episodeId)).run()
  }

  clearDownload(episodeId: string): void {
    this.db
      .update(episodes)
      .set({
        isDownloaded: false,
        localFilePath: null,
        downloadStatus: null,
        downloadedAt: null
      })
      .where(eq(episodes.id, episodeId))
      .run()
  }

  listLocalFilePaths(podcastId: string): string[] {
    return this.db
      .select({ localFilePath: episodes.localFilePath })
      .from(episodes)
      .where(eq(episodes.podcastId, podcastId))
      .all()
      .map((row) => row.localFilePath)
      .filter((path): path is string => Boolean(path))
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
