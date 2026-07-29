import { describe, expect, it } from 'vitest'

import { DownloadQueue, type QueueTask } from './download-queue'

function waitForStatus(
  queue: DownloadQueue,
  taskId: string,
  status: string,
  timeoutMs = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error(`timeout waiting for ${status}, got ${queue.getTask(taskId)?.status}`))
    }, timeoutMs)

    const unsubscribe = queue.onEvent((event) => {
      if (event.taskId === taskId && event.status === status) {
        clearTimeout(timer)
        unsubscribe()
        resolve()
      }
    })

    if (queue.getTask(taskId)?.status === status) {
      clearTimeout(timer)
      unsubscribe()
      resolve()
    }
  })
}

describe('DownloadQueue retry', () => {
  it('retries network failures with backoff then succeeds', async () => {
    let attempts = 0

    const queue = new DownloadQueue(
      async () => {
        attempts += 1
        if (attempts < 3) {
          throw Object.assign(new Error('network'), { code: 'NETWORK_ERROR' })
        }
        return { localFilePath: '/tmp/a.mp3', totalBytes: 10 }
      },
      1,
      { maxRetries: 3, backoffMs: [5, 5, 5] }
    )

    queue.enqueue({
      id: 't1',
      episodeId: 'e1',
      status: 'queued',
      progressBytes: 0,
      totalBytes: null,
      retryCount: 0
    } satisfies QueueTask)

    await waitForStatus(queue, 't1', 'completed')
    expect(attempts).toBe(3)
  })

  it('does not retry integrity failures', async () => {
    let attempts = 0
    const queue = new DownloadQueue(
      async () => {
        attempts += 1
        throw Object.assign(new Error('bad size'), { code: 'DOWNLOAD_INCOMPLETE' })
      },
      1,
      { maxRetries: 3, backoffMs: [5, 5, 5] }
    )

    queue.enqueue({
      id: 't2',
      episodeId: 'e2',
      status: 'queued',
      progressBytes: 0,
      totalBytes: 100,
      retryCount: 0
    } satisfies QueueTask)

    await waitForStatus(queue, 't2', 'failed')
    expect(attempts).toBe(1)
  })
})
