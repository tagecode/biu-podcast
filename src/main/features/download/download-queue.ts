import type { DownloadTaskStatus } from '@shared/types'

export interface QueueTask {
  id: string
  episodeId: string
  status: DownloadTaskStatus
  progressBytes: number
  totalBytes: number | null
  retryCount: number
}

export type DownloadRunner = (
  task: QueueTask,
  signal: AbortSignal,
  onProgress: (progressBytes: number, totalBytes: number | null) => void
) => Promise<{ localFilePath: string; totalBytes: number | null }>

export type QueueListener = (event: {
  type: 'progress' | 'status'
  taskId: string
  episodeId: string
  status: DownloadTaskStatus
  progressBytes: number
  totalBytes: number | null
  retryCount?: number
  localFilePath?: string
}) => void

export interface RetryOptions {
  maxRetries: number
  backoffMs: number[]
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  backoffMs: [5000, 15000, 45000]
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code !== 'DOWNLOAD_INCOMPLETE'
  }
  return true
}

/**
 * In-memory concurrency scheduler. Persistence is owned by DownloadService.
 */
export class DownloadQueue {
  private readonly tasks = new Map<string, QueueTask>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly active = new Set<string>()
  private readonly listeners = new Set<QueueListener>()
  private readonly retryTimers = new Map<string, NodeJS.Timeout>()
  private concurrency: number
  private runner: DownloadRunner
  private readonly retry: RetryOptions

  constructor(runner: DownloadRunner, concurrency = 2, retry: RetryOptions = DEFAULT_RETRY) {
    this.runner = runner
    this.concurrency = concurrency
    this.retry = retry
  }

  setRunner(runner: DownloadRunner): void {
    this.runner = runner
  }

  setConcurrency(value: number): void {
    this.concurrency = Math.max(1, value)
    this.pump()
  }

  onEvent(listener: QueueListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  enqueue(task: QueueTask): void {
    this.clearRetryTimer(task.id)
    this.tasks.set(task.id, { ...task, status: 'queued', retryCount: task.retryCount ?? 0 })
    this.emit(task.id)
    this.pump()
  }

  pause(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    this.clearRetryTimer(taskId)
    if (task.status === 'downloading') {
      this.controllers.get(taskId)?.abort()
    }
    task.status = 'paused'
    this.active.delete(taskId)
    this.emit(taskId)
    this.pump()
  }

  resume(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    if (task.status === 'paused' || task.status === 'failed') {
      this.clearRetryTimer(taskId)
      task.status = 'queued'
      this.emit(taskId)
      this.pump()
    }
  }

  cancel(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    this.clearRetryTimer(taskId)
    this.controllers.get(taskId)?.abort()
    this.controllers.delete(taskId)
    this.active.delete(taskId)
    this.tasks.delete(taskId)
  }

  getTask(taskId: string): QueueTask | undefined {
    return this.tasks.get(taskId)
  }

  list(): QueueTask[] {
    return [...this.tasks.values()]
  }

  downloadingCount(): number {
    return this.active.size
  }

  private clearRetryTimer(taskId: string): void {
    const timer = this.retryTimers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(taskId)
    }
  }

  private scheduleRetry(taskId: string, delayMs: number): void {
    this.clearRetryTimer(taskId)
    const timer = setTimeout(() => {
      this.retryTimers.delete(taskId)
      const task = this.tasks.get(taskId)
      if (!task || task.status !== 'queued') return
      this.pump()
    }, delayMs)
    this.retryTimers.set(taskId, timer)
  }

  private pump(): void {
    while (this.active.size < this.concurrency) {
      const next = [...this.tasks.values()].find(
        (task) => task.status === 'queued' && !this.retryTimers.has(task.id)
      )
      if (!next) break
      void this.start(next.id)
    }
  }

  private async start(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'queued') return

    const controller = new AbortController()
    this.controllers.set(taskId, controller)
    this.active.add(taskId)
    task.status = 'downloading'
    this.emit(taskId)

    try {
      const result = await this.runner(task, controller.signal, (progressBytes, totalBytes) => {
        const current = this.tasks.get(taskId)
        if (!current) return
        current.progressBytes = progressBytes
        current.totalBytes = totalBytes
        this.emit(taskId, 'progress')
      })
      const current = this.tasks.get(taskId)
      if (!current) return
      current.status = 'completed'
      current.progressBytes = result.totalBytes ?? current.progressBytes
      current.totalBytes = result.totalBytes
      this.emit(taskId, 'status', result.localFilePath)
    } catch (error) {
      const current = this.tasks.get(taskId)
      if (!current) return
      if (controller.signal.aborted && current.status === 'paused') {
        // paused intentionally
      } else if (controller.signal.aborted) {
        // cancelled — already removed
      } else if (isRetryable(error) && current.retryCount < this.retry.maxRetries) {
        current.retryCount += 1
        current.status = 'queued'
        this.emit(taskId)
        const delay =
          this.retry.backoffMs[current.retryCount - 1] ??
          this.retry.backoffMs[this.retry.backoffMs.length - 1] ??
          5000
        this.scheduleRetry(taskId, delay)
      } else {
        current.status = 'failed'
        this.emit(taskId)
      }
    } finally {
      this.active.delete(taskId)
      this.controllers.delete(taskId)
      this.pump()
    }
  }

  private emit(
    taskId: string,
    type: 'progress' | 'status' = 'status',
    localFilePath?: string
  ): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    for (const listener of this.listeners) {
      listener({
        type,
        taskId: task.id,
        episodeId: task.episodeId,
        status: task.status,
        progressBytes: task.progressBytes,
        totalBytes: task.totalBytes,
        retryCount: task.retryCount,
        ...(localFilePath ? { localFilePath } : {})
      })
    }
  }
}
