import { settingsStore, SettingsStore } from '../../infra/settings/store'
import { showNotification } from '../../infra/notification'
import { subscriptionService, SubscriptionService } from './subscription.service'

export interface AutoRefreshDeps {
  settings?: SettingsStore
  service?: SubscriptionService
  /** Injectable timer for tests. */
  setIntervalFn?: (fn: () => void, ms: number) => NodeJS.Timeout
  clearIntervalFn?: (t: NodeJS.Timeout) => void
}

const VALID_INTERVALS = [30, 60, 360] // minutes: 30min / 1h / 6h

/**
 * Background auto-refresh. Reads autoRefreshMinutes from settings (null =
 * manual) and refreshes all active subscriptions on the interval. New-episode
 * counts drive a system notification (P1-26). Does not run while downloads or
 * playback are active (main loop stays light).
 */
export class AutoRefreshScheduler {
  private timer: NodeJS.Timeout | null = null
  private readonly settings: SettingsStore
  private readonly service: SubscriptionService
  private readonly setIntervalFn: (fn: () => void, ms: number) => NodeJS.Timeout
  private readonly clearIntervalFn: (t: NodeJS.Timeout) => void

  constructor(deps: AutoRefreshDeps = {}) {
    this.settings = deps.settings ?? settingsStore
    this.service = deps.service ?? subscriptionService
    this.setIntervalFn = deps.setIntervalFn ?? setInterval
    this.clearIntervalFn = deps.clearIntervalFn ?? clearInterval
  }

  start(): void {
    this.restart()
  }

  stop(): void {
    if (this.timer) {
      this.clearIntervalFn(this.timer)
      this.timer = null
    }
  }

  /** Re-read settings and schedule/clear the timer accordingly. */
  restart(): void {
    this.stop()
    const minutes = this.settings.getAll().autoRefreshMinutes
    if (!minutes || !VALID_INTERVALS.includes(minutes)) return
    this.timer = this.setIntervalFn(() => void this.tick(), minutes * 60 * 1000)
  }

  private async tick(): Promise<void> {
    const results = await this.service.refreshAll()
    const totalNew = results.reduce((sum, r) => sum + r.addedCount, 0)
    if (totalNew > 0) {
      showNotification(
        { title: '博播', body: `发现 ${totalNew} 集新内容` },
        this.settings.getAll().notificationsEnabled
      )
    }
  }
}

export const autoRefreshScheduler = new AutoRefreshScheduler()
