import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

// Mock electron. clearAllData() calls app.relaunch/app.exit; clearCache uses
// session.defaultSession. We stub them to observe behaviour without relaunching.
const state = vi.hoisted(() => {
  const calls: string[] = []
  return { userData: '', calls }
})
const userData = mkdtempSync(join(tmpdir(), 'biu-cleanup-'))
state.userData = userData

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return state.userData
      throw new Error(`unexpected getPath('${name}')`)
    }),
    relaunch: vi.fn(() => {
      state.calls.push('relaunch')
    }),
    exit: vi.fn(() => {
      state.calls.push('exit')
    })
  },
  session: {
    defaultSession: {
      clearCache: vi.fn(async () => undefined),
      clearStorageData: vi.fn(async () => undefined)
    }
  },
  dialog: {
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined }))
  }
}))

import { cleanupService } from './cleanup.service'
import { getDatabasePath } from '../../infra/db/client'

describe('CleanupService', () => {
  const downloadDir = join(state.userData, 'downloads')
  const settingsPath = join(state.userData, 'settings.json')
  // Point the DB path into the temp userData (re-stubbed per test because
  // afterEach restores envs).
  let dbPath: string

  beforeEach(() => {
    vi.stubEnv('BIU_PODCAST_DB_PATH', join(state.userData, 'biu-podcast.db'))
    state.calls.length = 0
    dbPath = getDatabasePath()
    writeFileSync(join(state.userData, 'settings.json'), JSON.stringify({ loggingEnabled: true }))
    // Seed a fake DB + a downloaded file.
    writeFileSync(dbPath, 'fake-db-bytes')
    writeFileSync(settingsPath, JSON.stringify({ resumeOnLaunch: true }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('clearCache keeps the database and settings', async () => {
    await cleanupService.clearCache()

    expect(existsSync(dbPath)).toBe(true)
    expect(existsSync(settingsPath)).toBe(true)
    // No relaunch for a mere cache clear.
    expect(state.calls).not.toContain('relaunch')
  })

  it('clearAllData removes db/downloads/settings and relaunches', async () => {
    mkdirSync(join(downloadDir, 'pod'), { recursive: true })
    writeFileSync(join(downloadDir, 'pod', '1.mp3'), 'audio')
    writeFileSync(settingsPath, JSON.stringify({ resumeOnLaunch: true }))

    await cleanupService.clearAllData()

    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(downloadDir)).toBe(false)
    expect(existsSync(settingsPath)).toBe(false)
    expect(state.calls).toContain('relaunch')
    expect(state.calls).toContain('exit')
  })
})
