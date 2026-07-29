import { desc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import type { AppDatabase } from '../../infra/db/client'
import { downloadTasks, episodes, podcasts } from '../../infra/db/schema'
import type { DownloadTask, DownloadTaskStatus } from '@shared/types'

export class DownloadRepository {
  constructor(private readonly db: AppDatabase) {}

  insert(episodeId: string, status: DownloadTaskStatus = 'queued'): DownloadTask {
    const id = ulid()
    const updatedAt = Date.now()
    this.db
      .insert(downloadTasks)
      .values({
        id,
        episodeId,
        status,
        progressBytes: 0,
        totalBytes: null,
        retryCount: 0,
        updatedAt
      })
      .run()
    return {
      id,
      episodeId,
      status,
      progressBytes: 0,
      totalBytes: null,
      retryCount: 0,
      updatedAt
    }
  }

  findById(id: string): DownloadTask | null {
    const row = this.db.select().from(downloadTasks).where(eq(downloadTasks.id, id)).get()
    return row ? this.toTask(row) : null
  }

  findActiveByEpisode(episodeId: string): DownloadTask | null {
    const rows = this.db
      .select()
      .from(downloadTasks)
      .where(eq(downloadTasks.episodeId, episodeId))
      .orderBy(desc(downloadTasks.updatedAt))
      .all()
    const active = rows.find((row) => ['queued', 'downloading', 'paused'].includes(row.status))
    return active ? this.toTask(active) : null
  }

  listActive(): DownloadTask[] {
    const rows = this.db
      .select({
        task: downloadTasks,
        episodeTitle: episodes.title,
        podcastTitle: podcasts.title
      })
      .from(downloadTasks)
      .innerJoin(episodes, eq(episodes.id, downloadTasks.episodeId))
      .innerJoin(podcasts, eq(podcasts.id, episodes.podcastId))
      .orderBy(desc(downloadTasks.updatedAt))
      .all()

    return rows
      .filter((row) => ['queued', 'downloading', 'paused', 'failed'].includes(row.task.status))
      .map((row) => ({
        ...this.toTask(row.task),
        episodeTitle: row.episodeTitle,
        podcastTitle: row.podcastTitle
      }))
  }

  update(
    id: string,
    patch: Partial<{
      status: DownloadTaskStatus
      progressBytes: number
      totalBytes: number | null
      retryCount: number
    }>
  ): void {
    this.db
      .update(downloadTasks)
      .set({ ...patch, updatedAt: Date.now() })
      .where(eq(downloadTasks.id, id))
      .run()
  }

  delete(id: string): void {
    this.db.delete(downloadTasks).where(eq(downloadTasks.id, id)).run()
  }

  listInterrupted(): DownloadTask[] {
    return this.db
      .select()
      .from(downloadTasks)
      .all()
      .filter((row) => row.status === 'downloading')
      .map((row) => this.toTask(row))
  }

  private toTask(row: typeof downloadTasks.$inferSelect): DownloadTask {
    return {
      id: row.id,
      episodeId: row.episodeId,
      status: row.status as DownloadTaskStatus,
      progressBytes: row.progressBytes,
      totalBytes: row.totalBytes,
      retryCount: row.retryCount,
      updatedAt: row.updatedAt
    }
  }
}
