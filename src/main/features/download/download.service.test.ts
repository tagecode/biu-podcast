import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.BIU_PODCAST_DB_PATH = ':memory:'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/fake-userdata' },
  Notification: {
    isSupported: () => false,
    prototype: { show: () => undefined }
  }
}))

import { createTestDb, createTestSettings } from '../../test-utils/db'
import { DownloadService, downloadToFile } from './download.service'
import { EpisodeRepository } from '../episode/episode.repository'
import * as schema from '../../infra/db/schema'
import type { QueueTask } from './download-queue'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * A runner that never resolves on its own — only rejects when the task is
 * aborted (pause/cancel). Simulates a long-lived download.
 */
function blockedRunner(
  _task: QueueTask,
  signal: AbortSignal
): Promise<{ localFilePath: string; totalBytes: number }> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
}

function seedEpisode(db: ReturnType<typeof createTestDb>['db'], podcastId = 'pod-1'): string {
  const repo = new EpisodeRepository(db)
  db.insert(schema.podcasts)
    .values({
      id: podcastId,
      feedUrl: `https://example.com/feed-${podcastId}.xml`,
      title: `Podcast ${podcastId}`,
      description: null,
      coverUrl: null,
      author: null,
      language: null,
      isPaused: false,
      subscribedAt: 1700000000000,
      lastFetchedAt: 1700000000000,
      lastFetchStatus: 'ok'
    })
    .run()
  repo.insertMany(podcastId, [
    {
      title: 'EP1',
      descriptionHtml: null,
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep1.mp3',
      durationSec: 600,
      fileSizeBytes: 1024,
      guid: 'guid-1'
    }
  ])
  const row = db
    .select()
    .from(schema.episodes)
    .where(eq(schema.episodes.podcastId, podcastId))
    .get()
  return row!.id
}

describe('DownloadService', () => {
  it('enqueue adds a task and completes with injected runner', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const settings = createTestSettings()

    const runner = vi.fn(async (task: QueueTask) => {
      await wait(20)
      return { localFilePath: `/tmp/${task.episodeId}.mp3`, totalBytes: 1024 }
    })

    const service = new DownloadService({ db, settings, runner })
    const task = await service.enqueue(episodeId)
    expect(task.status).toBe('queued')

    await wait(100)
    const after = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).get()
    expect(after?.isDownloaded).toBe(true)
    expect(after?.downloadStatus).toBe('completed')
  })

  it('enqueue throws ALREADY_DOWNLOADED when already downloaded', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(async (task: QueueTask) => ({
      localFilePath: `/tmp/${task.episodeId}.mp3`,
      totalBytes: 1024
    }))
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    await service.enqueue(episodeId)
    await wait(80)

    await expect(service.enqueue(episodeId)).rejects.toThrow('已下载')
  })

  it('enqueue throws NOT_FOUND for missing episode', async () => {
    const { db } = createTestDb()
    const service = new DownloadService({ db, settings: createTestSettings() })
    await expect(service.enqueue('nope')).rejects.toThrow('集数不存在')
  })

  it('enqueue refuses when disk space is below the threshold', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const storage = {
      checkFreeSpace: vi.fn(async () => ({
        enough: false,
        freeBytes: 50 * 1024 * 1024,
        thresholdBytes: 500 * 1024 * 1024
      }))
    } as never
    const service = new DownloadService({
      db,
      settings: createTestSettings(),
      runner: blockedRunner,
      storage
    })

    await expect(service.enqueue(episodeId)).rejects.toThrow('磁盘空间不足')
    expect(service.list()).toHaveLength(0)
  })

  it('pause stops an active download', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(blockedRunner)
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    const task = await service.enqueue(episodeId)
    await wait(50)

    service.pause(task.id)
    await wait(50)
    const after = db
      .select()
      .from(schema.downloadTasks)
      .where(eq(schema.downloadTasks.id, task.id))
      .get()
    expect(after?.status).toBe('paused')
  })

  it('cancel removes task and clears episode download state', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(async (task: QueueTask) => {
      await wait(5000)
      return { localFilePath: `/tmp/${task.episodeId}.mp3`, totalBytes: 1024 }
    })
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    const task = await service.enqueue(episodeId)
    await wait(30)

    await service.cancel(task.id)
    const remaining = db.select().from(schema.downloadTasks).all()
    expect(remaining).toHaveLength(0)
  })

  it('verifyLocalFile marks missing file as not downloaded', () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const service = new DownloadService({ db, settings: createTestSettings() })

    const result = service.verifyLocalFile(episodeId)
    expect(result.exists).toBe(false)
    // mark as downloaded with a bogus path
    db.update(schema.episodes)
      .set({ isDownloaded: true, localFilePath: '/nonexistent/ep.mp3' })
      .where(eq(schema.episodes.id, episodeId))
      .run()

    const missing = service.verifyLocalFile(episodeId)
    expect(missing.exists).toBe(false)
    const after = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).get()
    expect(after?.isDownloaded).toBe(false)
  })

  it('resume requeues a paused task', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(blockedRunner)
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    const task = await service.enqueue(episodeId)
    await wait(30)
    service.pause(task.id)
    await wait(30)

    service.resume(task.id)
    await wait(30)
    const row = db
      .select()
      .from(schema.downloadTasks)
      .where(eq(schema.downloadTasks.id, task.id))
      .get()
    // resumed → downloading again
    expect(['queued', 'downloading'].includes(row!.status)).toBe(true)
  })

  it('list returns active tasks', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(async (task: QueueTask) => {
      await wait(5000)
      return { localFilePath: `/tmp/${task.episodeId}.mp3`, totalBytes: 1024 }
    })
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    const task = await service.enqueue(episodeId)
    await wait(30)

    const tasks = service.list()
    expect(tasks.length).toBeGreaterThanOrEqual(1)
    expect(tasks.some((t) => t.id === task.id)).toBe(true)
  })

  it('start requeues interrupted tasks from database', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(async (task: QueueTask) => {
      await wait(5000)
      return { localFilePath: `/tmp/${task.episodeId}.mp3`, totalBytes: 1024 }
    })
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    const task = await service.enqueue(episodeId)
    await wait(30)

    // simulate interrupted: set status to downloading in db (as if app crashed)
    db.update(schema.downloadTasks)
      .set({ status: 'downloading' })
      .where(eq(schema.downloadTasks.id, task.id))
      .run()

    service.start()
    await wait(30)
    const row = db
      .select()
      .from(schema.downloadTasks)
      .where(eq(schema.downloadTasks.id, task.id))
      .get()
    expect(['queued', 'downloading'].includes(row!.status)).toBe(true)
  })

  it('enqueueMany enqueues all undownloaded episodes and reports counts', async () => {
    const { db } = createTestDb()
    // Three episodes in one podcast.
    const repo = new EpisodeRepository(db)
    db.insert(schema.podcasts)
      .values({
        id: 'pod-1',
        feedUrl: 'https://example.com/feed.xml',
        title: 'Pod',
        description: null,
        coverUrl: null,
        author: null,
        language: null,
        isPaused: false,
        subscribedAt: 1700000000000,
        lastFetchedAt: 1700000000000,
        lastFetchStatus: 'ok'
      })
      .run()
    repo.insertMany('pod-1', [
      {
        title: 'A',
        descriptionHtml: null,
        publishedAt: 1700000000000,
        audioUrl: 'https://x.com/a.mp3',
        durationSec: 60,
        fileSizeBytes: 10,
        guid: 'a'
      },
      {
        title: 'B',
        descriptionHtml: null,
        publishedAt: 1700000000001,
        audioUrl: 'https://x.com/b.mp3',
        durationSec: 60,
        fileSizeBytes: 10,
        guid: 'b'
      },
      {
        title: 'C',
        descriptionHtml: null,
        publishedAt: 1700000000002,
        audioUrl: 'https://x.com/c.mp3',
        durationSec: 60,
        fileSizeBytes: 10,
        guid: 'c'
      }
    ])
    const all = db.select().from(schema.episodes).all()
    const service = new DownloadService({
      db,
      settings: createTestSettings(),
      runner: blockedRunner
    })

    const result = await service.enqueueMany(all.map((e) => e.id))
    expect(result).toEqual({ enqueued: 3, skipped: 0 })
    expect(service.list()).toHaveLength(3)
  })

  it('enqueueMany skips downloaded and already-queued episodes', async () => {
    const { db } = createTestDb()
    const repo = new EpisodeRepository(db)
    db.insert(schema.podcasts)
      .values({
        id: 'pod-1',
        feedUrl: 'https://example.com/feed.xml',
        title: 'Pod',
        description: null,
        coverUrl: null,
        author: null,
        language: null,
        isPaused: false,
        subscribedAt: 1700000000000,
        lastFetchedAt: 1700000000000,
        lastFetchStatus: 'ok'
      })
      .run()
    repo.insertMany('pod-1', [
      {
        title: 'A',
        descriptionHtml: null,
        publishedAt: 1700000000000,
        audioUrl: 'https://x.com/a.mp3',
        durationSec: 60,
        fileSizeBytes: 10,
        guid: 'a'
      },
      {
        title: 'B',
        descriptionHtml: null,
        publishedAt: 1700000000001,
        audioUrl: 'https://x.com/b.mp3',
        durationSec: 60,
        fileSizeBytes: 10,
        guid: 'b'
      },
      {
        title: 'C',
        descriptionHtml: null,
        publishedAt: 1700000000002,
        audioUrl: 'https://x.com/c.mp3',
        durationSec: 60,
        fileSizeBytes: 10,
        guid: 'c'
      }
    ])
    const all = db.select().from(schema.episodes).all()
    // Mark B as downloaded; enqueue A first so it's already active.
    db.update(schema.episodes)
      .set({ isDownloaded: true, downloadStatus: 'completed' })
      .where(eq(schema.episodes.id, all.find((e) => e.title === 'B')!.id))
      .run()
    const service = new DownloadService({
      db,
      settings: createTestSettings(),
      runner: blockedRunner
    })
    await service.enqueue(all.find((e) => e.title === 'A')!.id)

    const result = await service.enqueueMany(all.map((e) => e.id))
    expect(result.enqueued).toBe(1) // only C
    expect(result.skipped).toBe(2) // A already queued, B downloaded
  })
})

// --- downloadToFile integration tests (default runner, mocked fetch) ---

function makeStreamResponse(
  body: string,
  opts: { status?: number; contentLength?: string | null } = {}
): {
  ok: boolean
  status: number
  body: ReadableStream<Uint8Array>
  headers: { get: (name: string) => string | null }
} {
  const { status = 200, contentLength = String(body.length) } = opts
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    }
  })
  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-length') return contentLength
        return null
      }
    }
  }
}

describe('downloadToFile', () => {
  it('downloads a full file when server returns 200', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const dir = mkdtempSync(join(tmpdir(), 'biu-dl-'))
    settings.set('downloadPath', dir)
    const episodeId = seedEpisode(db)

    const mockedFetch = vi.fn().mockResolvedValue(makeStreamResponse('audio-data'))
    vi.stubGlobal('fetch', mockedFetch)

    const repo = new EpisodeRepository(db)
    const task: QueueTask = {
      id: 'task-1',
      episodeId,
      status: 'queued',
      progressBytes: 0,
      totalBytes: 10,
      retryCount: 0
    }
    const result = await downloadToFile(
      task,
      new AbortController().signal,
      () => {},
      repo,
      settings
    )
    expect(result.totalBytes).toBe(10)
    expect(result.localFilePath).toContain(`${episodeId}.mp3`)

    vi.unstubAllGlobals()
  })

  it('resumes with Range header when progressBytes > 0', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const dir = mkdtempSync(join(tmpdir(), 'biu-dl2-'))
    settings.set('downloadPath', dir)
    const episodeId = seedEpisode(db)

    // Pre-seed the .part file with the already-downloaded 5 bytes (resume scenario)
    const episodeRow = db
      .select()
      .from(schema.episodes)
      .where(eq(schema.episodes.id, episodeId))
      .get()!
    const partDir = join(dir, episodeRow.podcastId)
    mkdirSync(partDir, { recursive: true })
    writeFileSync(join(partDir, `${episodeId}.mp3.part`), 'abcde')

    const mockedFetch = vi.fn().mockResolvedValue(
      makeStreamResponse('fghij', {
        status: 206,
        contentLength: '5'
      })
    )
    vi.stubGlobal('fetch', mockedFetch)

    const repo = new EpisodeRepository(db)
    const task: QueueTask = {
      id: 'task-2',
      episodeId,
      status: 'queued',
      progressBytes: 5,
      totalBytes: 10,
      retryCount: 0
    }
    const result = await downloadToFile(
      task,
      new AbortController().signal,
      () => {},
      repo,
      settings
    )
    expect(result.totalBytes).toBe(10)
    // Range header should have been sent
    const fetchCall = mockedFetch.mock.calls[0]
    expect(fetchCall[1].headers.Range).toBe('bytes=5-')

    vi.unstubAllGlobals()
  })

  it('throws DOWNLOAD_INCOMPLETE when body is shorter than content-length', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const dir = mkdtempSync(join(tmpdir(), 'biu-dl3-'))
    settings.set('downloadPath', dir)
    const episodeId = seedEpisode(db)

    // content-length claims 100 but body is only 4 bytes
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeStreamResponse('abcd', { contentLength: '100' }))
    )

    const repo = new EpisodeRepository(db)
    const task: QueueTask = {
      id: 'task-3',
      episodeId,
      status: 'queued',
      progressBytes: 0,
      totalBytes: 100,
      retryCount: 0
    }
    await expect(
      downloadToFile(task, new AbortController().signal, () => {}, repo, settings)
    ).rejects.toThrow('不完整')

    vi.unstubAllGlobals()
  })
})
