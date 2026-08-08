import { rm, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { app, session } from 'electron'

import { closeDb, getDatabasePath } from '../../infra/db/client'
import { settingsStore } from '../../infra/settings/store'
import { getDownloadDir } from '../download/download.service'
import { clearLogFiles } from '../../infra/logger'

const CACHE_DIR_NAMES = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'blob_storage',
  'Shared Dictionary'
]

/**
 * Two-level data reset (P1-29):
 *  - clearCache(): only browser caches / temp files — user data untouched.
 *  - clearAllData(): database + downloaded files + settings + caches → app
 *    returns to first-run state.
 */
export class CleanupService {
  /** Clear Chromium caches and temporary files. User data is preserved. */
  async clearCache(): Promise<void> {
    const userData = app.getPath('userData')

    // Chromium storage partitions (cleared via the session API when possible).
    try {
      await session.defaultSession.clearCache()
      await session.defaultSession.clearStorageData({ storages: ['localstorage'] })
    } catch {
      // Non-fatal — some caches are best-effort.
    }

    // Remaining cache dirs.
    for (const name of CACHE_DIR_NAMES) {
      await rm(join(userData, name), { recursive: true, force: true })
    }

    // Diagnostic logs are also disposable temp data.
    await clearLogFiles()
  }

  /**
   * Wipe the database, downloaded files, settings and caches, then relaunch
   * the app so it boots into a fresh first-run state (the DB file is deleted
   * while the process is still running, so the renderer would otherwise lose
   * its backend).
   */
  async clearAllData(): Promise<void> {
    // 1. Close the DB so the file is unlocked.
    closeDb()
    const dbPath = getDatabasePath()
    await rm(dbPath, { force: true })
    await rm(`${dbPath}-wal`, { force: true })
    await rm(`${dbPath}-shm`, { force: true })

    // 2. Downloaded audio files.
    const downloadDir = getDownloadDir(settingsStore)
    await rm(downloadDir, { recursive: true, force: true })

    // 3. Settings (electron-store files) + window state.
    await rm(join(app.getPath('userData'), 'settings.json'), { force: true })
    await rm(join(app.getPath('userData'), 'window-state.json'), { force: true })

    // 4. Caches.
    await this.clearCache()

    // 5. Legacy DB backups from migrations.
    const userData = app.getPath('userData')
    if (existsSync(userData)) {
      const entries = await readdir(userData)
      for (const entry of entries) {
        if (entry.startsWith('biu-podcast.db.bak-')) {
          await rm(join(userData, entry), { force: true })
        }
      }
    }

    // Relaunch into a fresh state.
    app.relaunch()
    app.exit(0)
  }
}

export const cleanupService = new CleanupService()
