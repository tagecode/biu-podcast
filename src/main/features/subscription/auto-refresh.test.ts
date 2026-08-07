import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { AutoRefreshScheduler, type AutoRefreshDeps } from './auto-refresh'
import type { SubscriptionService } from './subscription.service'

vi.mock('../../infra/notification', () => ({
  showNotification: vi.fn()
}))

import { showNotification } from '../../infra/notification'
import type { SettingsStore } from '../../infra/settings/store'

const showNotificationMock = showNotification as ReturnType<typeof vi.fn>

function makeSettings(autoRefreshMinutes: number | null): SettingsStore {
  return {
    getAll: () =>
      ({
        downloadPath: null,
        resumeOnLaunch: true,
        lastEpisodeId: null,
        lastPodcastId: null,
        lastPositionSec: 0,
        autoRefreshMinutes,
        notificationsEnabled: true
      }) as never
  } as unknown as SettingsStore
}

function makeService(
  refreshAllImpl: () => Promise<Array<{ podcastId: string; addedCount: number }>>
): SubscriptionService {
  return { refreshAll: refreshAllImpl } as unknown as SubscriptionService
}

describe('AutoRefreshScheduler', () => {
  let scheduled: Array<{ fn: () => void; ms: number }> = []
  let clears = 0

  const baseDeps = (): AutoRefreshDeps => ({
    setIntervalFn: ((fn: () => void, ms: number) => {
      scheduled.push({ fn, ms })
      return { ms } as unknown as NodeJS.Timeout
    }) as never,
    clearIntervalFn: () => {
      clears += 1
    }
  })

  beforeEach(() => {
    scheduled = []
    clears = 0
    showNotificationMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not schedule a timer when autoRefresh is null (manual)', () => {
    const scheduler = new AutoRefreshScheduler({ ...baseDeps(), settings: makeSettings(null) })
    scheduler.start()
    expect(scheduled).toHaveLength(0)
    scheduler.stop()
  })

  it('schedules a timer for a valid interval and skips invalid ones', () => {
    const s1 = new AutoRefreshScheduler({ ...baseDeps(), settings: makeSettings(60) })
    s1.start()
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0]!.ms).toBe(60 * 60 * 1000)
    s1.stop()

    scheduled = []
    const s2 = new AutoRefreshScheduler({ ...baseDeps(), settings: makeSettings(45) })
    s2.start()
    expect(scheduled).toHaveLength(0)
    s2.stop()
  })

  it('restart clears the previous timer and re-schedules', () => {
    const scheduler = new AutoRefreshScheduler({ ...baseDeps(), settings: makeSettings(60) })
    scheduler.start()
    scheduler.restart()
    expect(clears).toBeGreaterThanOrEqual(1)
    expect(scheduled.length).toBeGreaterThanOrEqual(1)
    scheduler.stop()
  })

  it('tick refreshes and notifies when new episodes are found', async () => {
    const refreshAll = vi.fn().mockResolvedValue([
      { podcastId: 'a', addedCount: 2 },
      { podcastId: 'b', addedCount: 0 }
    ])
    const scheduler = new AutoRefreshScheduler({
      ...baseDeps(),
      settings: makeSettings(60),
      service: makeService(refreshAll)
    })
    scheduler.start()
    // Fire the scheduled interval callback.
    await scheduled[0]!.fn()
    expect(refreshAll).toHaveBeenCalledTimes(1)
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: '发现 2 集新内容' }),
      true
    )
    scheduler.stop()
  })

  it('tick does not notify when there are no new episodes', async () => {
    const refreshAll = vi.fn().mockResolvedValue([{ podcastId: 'a', addedCount: 0 }])
    const scheduler = new AutoRefreshScheduler({
      ...baseDeps(),
      settings: makeSettings(60),
      service: makeService(refreshAll)
    })
    scheduler.start()
    await scheduled[0]!.fn()
    expect(showNotificationMock).not.toHaveBeenCalled()
    scheduler.stop()
  })
})
