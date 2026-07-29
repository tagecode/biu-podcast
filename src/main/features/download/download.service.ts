import { createWriteStream } from 'fs'
import { mkdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { app } from 'electron'

import { EpisodeRepository } from '../episode/episode.repository'
import { getDb } from '../../infra/db/client'
import { settingsStore } from '../../infra/settings/store'
import { AppError } from '@shared/errors'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { DownloadTask } from '@shared/types'
import { broadcast } from '../../ipc/register'

import { DownloadQueue, type QueueTask } from './download-queue'
import { DownloadRepository } from './download.repository'

function getDownloadDir(): string {
  const configured = settingsStore.getAll().downloadPath
  if (configured) return configured
  return join(app.getPath('userData'), 'downloads')
}

async function downloadToFile(
  task: QueueTask,
  signal: AbortSignal,
  onProgress: (progressBytes: number, totalBytes: number | null) => void,
  episodeRepo: EpisodeRepository
): Promise<{ localFilePath: string; totalBytes: number | null }> {
  const episode = episodeRepo.findById(task.episodeId)
  if (!episode) throw new AppError('NOT_FOUND', '集数不存在')

  const dir = join(getDownloadDir(), episode.podcastId)
  await mkdir(dir, { recursive: true })
  const finalPath = join(dir, `${episode.id}.mp3`)
  const partPath = `${finalPath}.part`

  const headers: Record<string, string> = {
    'User-Agent': 'BiuPodcast/1.0'
  }
  let startAt = task.progressBytes
  if (startAt > 0) {
    headers.Range = `bytes=${startAt}-`
  }

  const response = await fetch(episode.audioUrl, { signal, headers })
  if (!response.ok && response.status !== 206) {
    throw new AppError('NETWORK_ERROR', `下载失败（HTTP ${response.status}）`)
  }

  const isPartial = response.status === 206
  if (startAt > 0 && !isPartial) {
    await rm(partPath, { force: true })
    startAt = 0
  }

  const contentLength = response.headers.get('content-length')
  const chunkSize = contentLength ? Number.parseInt(contentLength, 10) : null
  const totalBytes = isPartial && chunkSize !== null ? startAt + chunkSize : chunkSize

  if (!response.body) {
    throw new AppError('NETWORK_ERROR', '下载响应为空')
  }

  const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream)
  const flags = startAt > 0 && isPartial ? 'a' : 'w'
  const fileStream = createWriteStream(partPath, { flags })

  let downloaded = startAt
  nodeStream.on('data', (chunk: Buffer) => {
    downloaded += chunk.length
    onProgress(downloaded, totalBytes)
  })

  await pipeline(nodeStream, fileStream)

  if (totalBytes !== null && downloaded < totalBytes) {
    throw new AppError('DOWNLOAD_INCOMPLETE', '下载文件不完整，请重试')
  }

  await rename(partPath, finalPath)
  const fileStat = await stat(finalPath)
  return { localFilePath: finalPath, totalBytes: fileStat.size }
}

export class DownloadService {
  private readonly db = getDb()
  private readonly downloads = new DownloadRepository(this.db)
  private readonly episodes = new EpisodeRepository(this.db)
  private readonly queue: DownloadQueue
  private started = false

  constructor() {
    this.queue = new DownloadQueue(async (task, signal, onProgress) => {
      const result = await downloadToFile(task, signal, onProgress, this.episodes)
      this.downloads.update(task.id, {
        status: 'completed',
        progressBytes: result.totalBytes ?? task.progressBytes,
        totalBytes: result.totalBytes
      })
      this.episodes.markDownloaded(task.episodeId, result.localFilePath)
      return result
    })

    this.queue.onEvent((event) => {
      if (event.type === 'progress') {
        this.downloads.update(event.taskId, {
          progressBytes: event.progressBytes,
          totalBytes: event.totalBytes,
          status: event.status
        })
      } else if (
        event.status === 'downloading' ||
        event.status === 'queued' ||
        event.status === 'paused'
      ) {
        this.downloads.update(event.taskId, { status: event.status })
        this.episodes.setDownloadStatus(event.episodeId, event.status)
      } else if (event.status === 'failed') {
        this.downloads.update(event.taskId, { status: 'failed' })
        this.episodes.setDownloadStatus(event.episodeId, 'failed')
      } else if (event.status === 'completed') {
        this.downloads.update(event.taskId, { status: 'completed' })
      }

      broadcast(IPC_CHANNELS.download.progress, {
        taskId: event.taskId,
        episodeId: event.episodeId,
        status: event.status,
        progressBytes: event.progressBytes,
        totalBytes: event.totalBytes
      })

      const episode = this.episodes.findById(event.episodeId)
      if (episode) {
        broadcast(IPC_CHANNELS.episode.changed, { podcastId: episode.podcastId })
      }
    })
  }

  start(): void {
    if (this.started) return
    this.started = true

    for (const interrupted of this.downloads.listInterrupted()) {
      this.downloads.update(interrupted.id, { status: 'queued' })
      this.queue.enqueue({
        id: interrupted.id,
        episodeId: interrupted.episodeId,
        status: 'queued',
        progressBytes: interrupted.progressBytes,
        totalBytes: interrupted.totalBytes
      })
    }

    for (const queued of this.downloads.listActive().filter((t) => t.status === 'queued')) {
      if (!this.queue.getTask(queued.id)) {
        this.queue.enqueue({
          id: queued.id,
          episodeId: queued.episodeId,
          status: 'queued',
          progressBytes: queued.progressBytes,
          totalBytes: queued.totalBytes
        })
      }
    }
  }

  enqueue(episodeId: string): DownloadTask {
    const episode = this.episodes.findById(episodeId)
    if (!episode) throw new AppError('NOT_FOUND', '集数不存在')
    if (episode.isDownloaded) {
      throw new AppError('ALREADY_DOWNLOADED', '该集数已下载')
    }

    const existing = this.downloads.findActiveByEpisode(episodeId)
    if (existing) return existing

    const task = this.downloads.insert(episodeId, 'queued')
    this.episodes.setDownloadStatus(episodeId, 'queued')
    this.queue.enqueue({
      id: task.id,
      episodeId,
      status: 'queued',
      progressBytes: 0,
      totalBytes: episode.fileSizeBytes
    })
    return { ...task, episodeTitle: episode.title }
  }

  list(): DownloadTask[] {
    return this.downloads.listActive()
  }

  pause(taskId: string): void {
    this.queue.pause(taskId)
  }

  resume(taskId: string): void {
    this.queue.resume(taskId)
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.downloads.findById(taskId)
    this.queue.cancel(taskId)
    if (!task) return

    const episode = this.episodes.findById(task.episodeId)
    this.downloads.delete(taskId)
    this.episodes.clearDownload(task.episodeId)
    if (episode) {
      const finalPath = join(getDownloadDir(), episode.podcastId, `${episode.id}.mp3`)
      await rm(`${finalPath}.part`, { force: true })
    }
  }
}

export const downloadService = new DownloadService()
