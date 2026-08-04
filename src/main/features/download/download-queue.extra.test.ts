import { describe, expect, it } from 'vitest'

import { DownloadQueue, type QueueTask } from './download-queue'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeTask(id: string, overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id,
    episodeId: `e-${id}`,
    status: 'queued',
    progressBytes: 0,
    totalBytes: 100,
    retryCount: 0,
    ...overrides
  }
}

describe('DownloadQueue progress + lifecycle coverage', () => {
  it('forwards progress events to listeners with running totals', async () => {
    const seen: Array<{ progressBytes: number; totalBytes: number | null }> = []
    const queue = new DownloadQueue(async (_task, _signal, onProgress) => {
      onProgress(30, 100)
      onProgress(70, 100)
      await wait(10)
      return { localFilePath: '/tmp/a.mp3', totalBytes: 100 }
    }, 1)
    queue.onEvent((event) => {
      if (event.type === 'progress') {
        seen.push({ progressBytes: event.progressBytes, totalBytes: event.totalBytes })
      }
    })
    queue.enqueue(makeTask('t1'))
    await wait(50)
    expect(seen).toEqual([
      { progressBytes: 30, totalBytes: 100 },
      { progressBytes: 70, totalBytes: 100 }
    ])
    expect(queue.getTask('t1')?.status).toBe('completed')
    expect(queue.getTask('t1')?.progressBytes).toBe(100)
  })

  it('setConcurrency grows beyond 1', async () => {
    let running = 0
    let maxRunning = 0
    const queue = new DownloadQueue(async (task, signal) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await wait(30)
      running -= 1
      if (signal.aborted) throw new Error('aborted')
      return { localFilePath: `/tmp/${task.id}`, totalBytes: 1 }
    }, 1)

    queue.enqueue(makeTask('a'))
    queue.enqueue(makeTask('b'))
    queue.enqueue(makeTask('c'))
    queue.setConcurrency(3)

    await wait(150)
    expect(maxRunning).toBeGreaterThanOrEqual(2)
    expect(queue.list().every((t) => t.status === 'completed')).toBe(true)
  })

  it('clearRetryTimer removes an existing retry timer on re-enqueue', async () => {
    let attempts = 0
    const queue = new DownloadQueue(
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw Object.assign(new Error('net'), { code: 'NETWORK_ERROR' })
        }
        return { localFilePath: '/tmp/a.mp3', totalBytes: 10 }
      },
      1,
      { maxRetries: 3, backoffMs: [60, 60, 60] }
    )
    queue.enqueue(makeTask('t1'))

    // Wait for the first attempt to fail and schedule a retry (backoff 60ms).
    await wait(20)
    expect(queue.getTask('t1')?.status).toBe('queued')

    // Re-enqueue the same id — clears the pending retry timer and runs now.
    queue.enqueue(makeTask('t1'))
    await wait(50)
    expect(queue.getTask('t1')?.status).toBe('completed')
    expect(attempts).toBe(2)
  })

  it('exhausts retries then marks failed', async () => {
    let attempts = 0
    const queue = new DownloadQueue(
      async () => {
        attempts += 1
        throw Object.assign(new Error('net'), { code: 'NETWORK_ERROR' })
      },
      1,
      { maxRetries: 2, backoffMs: [5, 5] }
    )
    queue.enqueue(makeTask('t1'))
    await wait(200)
    expect(queue.getTask('t1')?.status).toBe('failed')
    expect(attempts).toBe(3) // 1 initial + 2 retries
  })

  it('pause on a non-downloading task is a no-op', async () => {
    const queue = new DownloadQueue(async (task, signal) => {
      await wait(50)
      if (signal.aborted) throw new Error('aborted')
      return { localFilePath: `/tmp/${task.id}`, totalBytes: 1 }
    }, 1)
    queue.enqueue(makeTask('t1'))
    // Pause a task id that is neither queued nor downloading here.
    queue.pause('missing-id')
    await wait(100)
    expect(queue.getTask('t1')?.status).toBe('completed')
  })

  it('cancel removes a pending task and its retry timer', async () => {
    let attempts = 0
    const queue = new DownloadQueue(
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw Object.assign(new Error('net'), { code: 'NETWORK_ERROR' })
        }
        return { localFilePath: '/tmp/a.mp3', totalBytes: 10 }
      },
      1,
      { maxRetries: 3, backoffMs: [20] }
    )
    queue.enqueue(makeTask('t1'))
    await wait(80) // first attempt failed, retry scheduled
    queue.cancel('t1')
    await wait(80)
    expect(queue.getTask('t1')).toBeUndefined()
  })
})
