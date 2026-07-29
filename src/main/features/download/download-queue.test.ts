import { describe, expect, it } from 'vitest'

import { DownloadQueue, type QueueTask } from './download-queue'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('DownloadQueue', () => {
  it('limits concurrent downloads', async () => {
    let running = 0
    let maxRunning = 0

    const queue = new DownloadQueue(async (task, signal) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await wait(40)
      if (signal.aborted) throw new Error('aborted')
      running -= 1
      return { localFilePath: `/tmp/${task.episodeId}`, totalBytes: 10 }
    }, 2)

    const make = (id: string): QueueTask => ({
      id,
      episodeId: id,
      status: 'queued',
      progressBytes: 0,
      totalBytes: 10,
      retryCount: 0
    })

    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      queue.enqueue(make(id))
    }

    await wait(300)
    expect(maxRunning).toBeLessThanOrEqual(2)
    expect(queue.list().every((t) => t.status === 'completed')).toBe(true)
  })

  it('pauses a downloading task and schedules the next', async () => {
    const started: string[] = []
    const queue = new DownloadQueue(async (task, signal) => {
      started.push(task.id)
      await wait(80)
      if (signal.aborted) throw new Error('aborted')
      return { localFilePath: `/tmp/${task.id}`, totalBytes: 1 }
    }, 1)

    queue.enqueue({
      id: 't1',
      episodeId: 'e1',
      status: 'queued',
      progressBytes: 0,
      totalBytes: 1,
      retryCount: 0
    })
    queue.enqueue({
      id: 't2',
      episodeId: 'e2',
      status: 'queued',
      progressBytes: 0,
      totalBytes: 1,
      retryCount: 0
    })

    await wait(20)
    queue.pause('t1')
    await wait(150)

    expect(queue.getTask('t1')?.status).toBe('paused')
    expect(started).toContain('t2')
  })
})
