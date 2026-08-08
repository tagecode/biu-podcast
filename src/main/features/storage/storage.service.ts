import { stat } from 'fs/promises'
import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import { and, desc, eq, lt } from 'drizzle-orm'

import { getDb, type AppDatabase } from '../../infra/db/client'
import { episodes, podcasts } from '../../infra/db/schema'
import { settingsStore, SettingsStore } from '../../infra/settings/store'

export interface PodcastStorage {
  podcastId: string
  podcastTitle: string
  /** Sum of actual file sizes on disk for this podcast's downloaded episodes. */
  bytes: number
  downloadedCount: number
}

export interface StorageUsage {
  podcasts: PodcastStorage[]
  /** Sum of all per-podcast bytes. */
  totalBytes: number
}

export interface CleanupPreviewItem {
  episodeId: string
  podcastTitle: string
  episodeTitle: string
  /** Bytes that would be freed. */
  bytes: number
}

export interface CleanupPreview {
  items: CleanupPreviewItem[]
  totalBytes: number
}

interface StorageServiceDeps {
  db?: AppDatabase
  settings?: SettingsStore
}

/**
 * Storage accounting + retention cleanup (P1-27 / P1-28).
 *
 * Aggregates actual on-disk sizes per podcast and removes files for
 * downloaded-and-played episodes older than the retention window.
 */
export class StorageService {
  private readonly db: AppDatabase
  private readonly settings: SettingsStore

  constructor(deps: StorageServiceDeps = {}) {
    this.db = deps.db ?? getDb()
    this.settings = deps.settings ?? settingsStore
  }

  /** Aggregate actual on-disk size per podcast for downloaded episodes. */
  async computeUsage(): Promise<StorageUsage> {
    const rows = this.db
      .select({
        podcastId: episodes.podcastId,
        podcastTitle: podcasts.title,
        localFilePath: episodes.localFilePath
      })
      .from(episodes)
      .innerJoin(podcasts, eq(podcasts.id, episodes.podcastId))
      .where(eq(episodes.isDownloaded, true))
      .all()

    const byPodcast = new Map<string, PodcastStorage>()
    for (const row of rows) {
      if (!row.localFilePath || !existsSync(row.localFilePath)) continue
      let size = 0
      try {
        size = (await stat(row.localFilePath)).size
      } catch {
        // File missing/locked — skip it (episode state may be stale).
        continue
      }
      const entry = byPodcast.get(row.podcastId) ?? {
        podcastId: row.podcastId,
        podcastTitle: row.podcastTitle,
        bytes: 0,
        downloadedCount: 0
      }
      entry.bytes += size
      entry.downloadedCount += 1
      byPodcast.set(row.podcastId, entry)
    }

    const podcastsList = [...byPodcast.values()].sort((a, b) => b.bytes - a.bytes)
    return {
      podcasts: podcastsList,
      totalBytes: podcastsList.reduce((sum, p) => sum + p.bytes, 0)
    }
  }

  /** Retention window in ms from the setting (null = disabled). */
  private retentionCutoff(): number | null {
    const days = this.settings.getAll().cleanupRetentionDays
    if (!days || days <= 0) return null
    return Date.now() - days * 24 * 60 * 60 * 1000
  }

  /** Downloaded + played episodes older than the retention window. */
  private selectCandidates(cutoff: number): Array<{
    episodeId: string
    episodeTitle: string
    podcastTitle: string
    localFilePath: string
  }> {
    const rows = this.db
      .select({
        episodeId: episodes.id,
        episodeTitle: episodes.title,
        podcastTitle: podcasts.title,
        localFilePath: episodes.localFilePath
      })
      .from(episodes)
      .innerJoin(podcasts, eq(podcasts.id, episodes.podcastId))
      .where(
        and(
          eq(episodes.isDownloaded, true),
          eq(episodes.isPlayed, true),
          lt(episodes.downloadedAt ?? 0, cutoff)
        )
      )
      .orderBy(desc(episodes.downloadedAt))
      .all()
    return rows.flatMap((row) => {
      if (!row.localFilePath) return []
      if (!existsSync(row.localFilePath)) return []
      return [{ ...row, localFilePath: row.localFilePath }]
    })
  }

  /** Preview what a cleanup would remove, without deleting anything. */
  async previewCleanup(): Promise<CleanupPreview> {
    const cutoff = this.retentionCutoff()
    if (cutoff === null) return { items: [], totalBytes: 0 }
    const candidates = this.selectCandidates(cutoff)
    const items: CleanupPreviewItem[] = []
    let totalBytes = 0
    for (const candidate of candidates) {
      let bytes = 0
      try {
        bytes = (await stat(candidate.localFilePath)).size
      } catch {
        continue
      }
      items.push({
        episodeId: candidate.episodeId,
        podcastTitle: candidate.podcastTitle,
        episodeTitle: candidate.episodeTitle,
        bytes
      })
      totalBytes += bytes
    }
    return { items, totalBytes }
  }

  /**
   * Execute the retention cleanup: delete files and reset episode download
   * state. Returns the bytes freed. Best-effort per file.
   */
  async runCleanup(): Promise<{ freedBytes: number; removedCount: number }> {
    const preview = await this.previewCleanup()
    let removedCount = 0
    for (const item of preview.items) {
      const episode = this.db
        .select({ localFilePath: episodes.localFilePath })
        .from(episodes)
        .where(eq(episodes.id, item.episodeId))
        .get()
      if (!episode?.localFilePath) continue
      const filePath: string = episode.localFilePath
      try {
        await rm(filePath, { force: true })
      } catch {
        continue
      }
      this.db
        .update(episodes)
        .set({
          isDownloaded: false,
          localFilePath: null,
          downloadStatus: null,
          downloadedAt: null
        })
        .where(eq(episodes.id, item.episodeId))
        .run()
      removedCount += 1
    }
    return { freedBytes: preview.totalBytes, removedCount }
  }
}

export const storageService = new StorageService()
