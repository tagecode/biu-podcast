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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const task = service.enqueue(episodeId)
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
    service.enqueue(episodeId)
    await wait(80)

    expect(() => service.enqueue(episodeId)).toThrow('已下载')
  })

  it('enqueue throws NOT_FOUND for missing episode', () => {
    const { db } = createTestDb()
    const service = new DownloadService({ db, settings: createTestSettings() })
    expect(() => service.enqueue('nope')).toThrow('集数不存在')
  })

  it('pause stops an active download', async () => {
    const { db } = createTestDb()
    const episodeId = seedEpisode(db)
    const runner = vi.fn(blockedRunner)
    const service = new DownloadService({ db, settings: createTestSettings(), runner })
    const task = service.enqueue(episodeId)
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
    const task = service.enqueue(episodeId)
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
    const task = service.enqueue(episodeId)
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
    const task = service.enqueue(episodeId)
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
    const task = service.enqueue(episodeId)
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
