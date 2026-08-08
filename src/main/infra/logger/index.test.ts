import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFile, readdir } from 'fs/promises'

// Mock electron: only app.getPath('userData') is used by the logger.
const userData = { value: mkdtempSync(join(tmpdir(), 'biu-logger-')) }
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => userData.value),
    getName: vi.fn(() => 'biu-podcast'),
    getVersion: vi.fn(() => '2.0.0')
  },
  dialog: {
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined }))
  }
}))

import { settingsStore } from '../settings/store'
import { writeLog, collectDiagnostics, clearLogFiles, logError } from './index'

// Pin logging on for the test.
settingsStore.set('loggingEnabled', true)

afterEach(() => {
  settingsStore.set('loggingEnabled', true)
})

describe('diagnostic logger', () => {
  it('writes a formatted log line to the logs dir', async () => {
    await writeLog('error', 'feed', 'boom')
    const dir = join(userData.value, 'logs')
    const files = await readdir(dir)
    expect(files).toContain('biu-podcast.log')
    const content = await readFile(join(dir, 'biu-podcast.log'), 'utf-8')
    expect(content).toContain('[error]')
    expect(content).toContain('[feed]')
    expect(content).toContain('boom')
  })

  it('honours the loggingEnabled setting', async () => {
    settingsStore.set('loggingEnabled', false)
    await logError('feed', 'should-not-appear')
    settingsStore.set('loggingEnabled', true)
    const dir = join(userData.value, 'logs')
    let content = ''
    try {
      content = await readFile(join(dir, 'biu-podcast.log'), 'utf-8')
    } catch {
      content = ''
    }
    expect(content).not.toContain('should-not-appear')
  })

  it('collectDiagnostics returns env info + log content', async () => {
    await writeLog('info', 'playback', 'started')
    const info = await collectDiagnostics()
    expect(info.appVersion).toBe('2.0.0')
    expect(info.platform).toBeDefined()
    expect(info.log).toContain('started')
    expect(info.loggingEnabled).toBe(true)
  })

  it('clearLogFiles removes the log file', async () => {
    await writeLog('warn', 'download', 'retry')
    await clearLogFiles()
    const dir = join(userData.value, 'logs')
    let files: string[] = []
    try {
      files = await readdir(dir)
    } catch {
      files = []
    }
    expect(files).not.toContain('biu-podcast.log')
  })
})
