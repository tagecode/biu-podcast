import ElectronStore from 'electron-store'

import type { AppSettings } from '@shared/types'

const defaults: AppSettings = {
  downloadPath: null,
  resumeOnLaunch: true,
  lastEpisodeId: null,
  lastPodcastId: null,
  lastPositionSec: 0
}

// electron-store v9+ is ESM-only. electron-vite externalizes it into CJS
// `require()`, which returns `{ default: Store }` — not a constructor.
const Store = ((ElectronStore as unknown as { default?: typeof ElectronStore }).default ??
  ElectronStore) as typeof ElectronStore

export class SettingsStore {
  private readonly store = new Store<AppSettings>({
    name: 'settings',
    defaults
  })

  getAll(): AppSettings {
    return {
      downloadPath: this.store.get('downloadPath'),
      resumeOnLaunch: this.store.get('resumeOnLaunch'),
      lastEpisodeId: this.store.get('lastEpisodeId'),
      lastPodcastId: this.store.get('lastPodcastId'),
      lastPositionSec: this.store.get('lastPositionSec')
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
