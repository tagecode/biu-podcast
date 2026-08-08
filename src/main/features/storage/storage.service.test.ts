import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createMemoryDb, type AppDatabase } from '../../infra/db/client'
import { episodes, podcasts } from '../../infra/db/schema'
import { eq } from 'drizzle-orm'
import { StorageService } from './storage.service'
import { SettingsStore } from '../../infra/settings/store'

function createSchema(sqlite: ReturnType<typeof createMemoryDb>['sqlite']): void {
  sqlite.exec(`
    CREATE TABLE podcasts (
      id text PRIMARY KEY NOT NULL,
      feed_url text NOT NULL UNIQUE,
      title text NOT NULL,
      description text,
      cover_url text,
      author text,
      language text,
      is_paused integer DEFAULT false NOT NULL,
      unsubscribed_at integer,
      subscribed_at integer NOT NULL,
      last_fetched_at integer,
      last_fetch_status text
    );
    CREATE TABLE episodes (
      id text PRIMARY KEY NOT NULL,
      podcast_id text NOT NULL,
      guid text,
      title text NOT NULL,
      description_html text,
      published_at integer NOT NULL,
      audio_url text NOT NULL,
      duration_sec integer,
      file_size_bytes integer,
      is_played integer DEFAULT false NOT NULL,
      playback_position_sec real DEFAULT 0 NOT NULL,
      is_downloaded integer DEFAULT false NOT NULL,
      local_file_path text,
      download_status text,
      downloaded_at integer,
      FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE cascade
    );
  `)
}

function makeSettings(retentionDays: number | null): SettingsStore {
  return {
    getAll: () =>
      ({
        cleanupRetentionDays: retentionDays
      }) as never
  } as unknown as SettingsStore
}

describe('StorageService', () => {
  let sqlite: ReturnType<typeof createMemoryDb>['sqlite']
  let db: AppDatabase
  let downloadsDir: string

  beforeEach(() => {
    const mem = createMemoryDb()
    sqlite = mem.sqlite
    db = mem.db
    createSchema(sqlite)
    downloadsDir = mkdtempSync(join(tmpdir(), 'biu-storage-'))
  })

  afterEach(() => {
    sqlite.close()
  })

  function seedPodcast(id: string, title: string): void {
    db.insert(podcasts)
      .values({ id, feedUrl: `https://example.com/${id}.xml`, title, subscribedAt: Date.now() })
      .run()
  }

  function seedEpisode(opts: {
    id: string
    podcastId: string
    title: string
    downloaded: boolean
    played: boolean
    downloadedAt?: number
    fileBytes: number
  }): void {
    const filePath = opts.downloaded ? join(downloadsDir, `${opts.id}.mp3`) : null
    if (filePath) writeFileSync(filePath, Buffer.alloc(opts.fileBytes))
    db.insert(episodes)
      .values({
        id: opts.id,
        podcastId: opts.podcastId,
        title: opts.title,
        publishedAt: Date.now(),
        audioUrl: `https://example.com/${opts.id}.mp3`,
        isDownloaded: opts.downloaded,
        isPlayed: opts.played,
        localFilePath: filePath,
        downloadedAt: opts.downloadedAt ?? Date.now(),
        downloadStatus: opts.downloaded ? 'completed' : null
      })
      .run()
  }

  it('aggregates usage per podcast from real file sizes', async () => {
    seedPodcast('p1', '播客一')
    seedPodcast('p2', '播客二')
    seedEpisode({
      id: 'e1',
      podcastId: 'p1',
      title: 'A',
      downloaded: true,
      played: false,
      fileBytes: 100
    })
    seedEpisode({
      id: 'e2',
      podcastId: 'p1',
      title: 'B',
      downloaded: true,
      played: false,
      fileBytes: 200
    })
    seedEpisode({
      id: 'e3',
      podcastId: 'p2',
      title: 'C',
      downloaded: true,
      played: false,
      fileBytes: 400
    })
    // Not downloaded → excluded.
    seedEpisode({
      id: 'e4',
      podcastId: 'p2',
      title: 'D',
      downloaded: false,
      played: false,
      fileBytes: 999
    })

    const service = new StorageService({ db, settings: makeSettings(null) })
    const usage = await service.computeUsage()

    expect(usage.totalBytes).toBe(700)
    expect(usage.podcasts).toHaveLength(2)
    const p1 = usage.podcasts.find((p) => p.podcastId === 'p1')
    expect(p1?.bytes).toBe(300)
    expect(p1?.downloadedCount).toBe(2)
    // Sorted by bytes descending.
    expect(usage.podcasts[0]!.podcastId).toBe('p2')
  })

  it('cleanup preview only selects downloaded + played + older than retention', async () => {
    const now = Date.now()
    seedPodcast('p1', '播客一')
    // Old + played + downloaded → candidate.
    seedEpisode({
      id: 'e1',
      podcastId: 'p1',
      title: '旧已听',
      downloaded: true,
      played: true,
      downloadedAt: now - 10 * 24 * 3600 * 1000,
      fileBytes: 100
    })
    // Old but not played → keep.
    seedEpisode({
      id: 'e2',
      podcastId: 'p1',
      title: '旧未听',
      downloaded: true,
      played: false,
      downloadedAt: now - 10 * 24 * 3600 * 1000,
      fileBytes: 200
    })
    // Recent + played → keep.
    seedEpisode({
      id: 'e3',
      podcastId: 'p1',
      title: '新已听',
      downloaded: true,
      played: true,
      downloadedAt: now,
      fileBytes: 400
    })

    const service = new StorageService({ db, settings: makeSettings(7) })
    const preview = await service.previewCleanup()

    expect(preview.items).toHaveLength(1)
    expect(preview.items[0]!.episodeId).toBe('e1')
    expect(preview.items[0]!.bytes).toBe(100)
    expect(preview.totalBytes).toBe(100)
  })

  it('cleanup deletes files and resets episode download state', async () => {
    const now = Date.now()
    seedPodcast('p1', '播客一')
    seedEpisode({
      id: 'e1',
      podcastId: 'p1',
      title: '旧已听',
      downloaded: true,
      played: true,
      downloadedAt: now - 10 * 24 * 3600 * 1000,
      fileBytes: 150
    })

    const service = new StorageService({ db, settings: makeSettings(7) })
    const result = await service.runCleanup()

    expect(result.removedCount).toBe(1)
    expect(result.freedBytes).toBe(150)

    const row = db.select().from(episodes).where(eq(episodes.id, 'e1')).get()
    expect(row?.isDownloaded).toBe(false)
    expect(row?.localFilePath).toBeNull()
  })

  it('cleanup is a no-op when retention is disabled', async () => {
    const now = Date.now()
    seedPodcast('p1', '播客一')
    seedEpisode({
      id: 'e1',
      podcastId: 'p1',
      title: '旧已听',
      downloaded: true,
      played: true,
      downloadedAt: now - 10 * 24 * 3600 * 1000,
      fileBytes: 150
    })

    const service = new StorageService({ db, settings: makeSettings(null) })
    const preview = await service.previewCleanup()
    const result = await service.runCleanup()

    expect(preview.items).toHaveLength(0)
    expect(result.removedCount).toBe(0)
  })
})
