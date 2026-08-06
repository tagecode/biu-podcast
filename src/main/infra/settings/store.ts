import ElectronStore from 'electron-store'

import type { AppSettings } from '@shared/types'

const defaults: AppSettings = {
  downloadPath: null,
  resumeOnLaunch: true,
  lastEpisodeId: null,
  lastPodcastId: null,
  lastPositionSec: 0,
  autoRefreshMinutes: null
}

// electron-store v9+ is ESM-only. electron-vite externalizes it into CJS
// `require()`, which returns `{ default: Store }` — not a constructor.
const Store = ((ElectronStore as unknown as { default?: typeof ElectronStore }).default ??
  ElectronStore) as typeof ElectronStore

export class SettingsStore {
  private readonly store: ElectronStore<AppSettings>

  constructor(options: { cwd?: string } = {}) {
    // conf@15 requires projectName at runtime; electron-store's published
    // types omit it (Except<...,'projectName'>), so cast through unknown.
    const storeOptions = {
      name: 'settings',
      projectName: 'biu-podcast',
      defaults,
      ...(options.cwd ? { cwd: options.cwd } : {})
    } as unknown as ConstructorParameters<typeof ElectronStore<AppSettings>>[0]

    this.store = new Store<AppSettings>(storeOptions)
  }

  getAll(): AppSettings {
    return {
      downloadPath: this.store.get('downloadPath'),
      resumeOnLaunch: this.store.get('resumeOnLaunch'),
      lastEpisodeId: this.store.get('lastEpisodeId'),
      lastPodcastId: this.store.get('lastPodcastId'),
      lastPositionSec: this.store.get('lastPositionSec'),
      autoRefreshMinutes: this.store.get('autoRefreshMinutes')
    }
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value)
  }

  setLastSession(episodeId: string, podcastId: string, positionSec: number): void {
    this.store.set('lastEpisodeId', episodeId)
    this.store.set('lastPodcastId', podcastId)
    this.store.set('lastPositionSec', positionSec)
  }
}

export const settingsStore = new SettingsStore()
