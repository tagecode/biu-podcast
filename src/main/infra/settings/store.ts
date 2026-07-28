import Store from 'electron-store'

import type { AppSettings } from '@shared/types'

const defaults: AppSettings = {
  downloadPath: null,
  resumeOnLaunch: true
}

export class SettingsStore {
  private readonly store = new Store<AppSettings>({
    name: 'settings',
    defaults
  })

  getAll(): AppSettings {
    return {
      downloadPath: this.store.get('downloadPath'),
      resumeOnLaunch: this.store.get('resumeOnLaunch')
    }
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value)
  }
}

export const settingsStore = new SettingsStore()
