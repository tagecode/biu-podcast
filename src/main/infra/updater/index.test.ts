import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock electron-updater before importing the service.
const mocks = vi.hoisted(() => {
  const autoUpdaterMock = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn()
  }
  const webContentsSend = vi.fn()
  const windowMock = {
    isDestroyed: vi.fn(() => false),
    webContents: { send: webContentsSend }
  }
  const appIsPackaged = { value: false }
  return { autoUpdaterMock, webContentsSend, windowMock, appIsPackaged }
})

vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdaterMock }))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.appIsPackaged.value
    }
  },
  BrowserWindow: {}
}))

import { updateService, type UpdatePhase } from './index'

const { autoUpdaterMock, webContentsSend, windowMock, appIsPackaged } = mocks

/** The event-name→handler map registered by the service. */
const eventHandlers = (): Record<string, (...args: unknown[]) => void> => {
  const handlers: Record<string, (...args: unknown[]) => void> = {}
  for (const [name, fn] of autoUpdaterMock.on.mock.calls as Array<
    [string, (...a: unknown[]) => void]
  >) {
    handlers[name] = fn
  }
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  autoUpdaterMock.on.mockReset()
  appIsPackaged.value = false
  updateService.init(() => windowMock as never)
})

afterEach(() => {
  vi.resetModules()
})

describe('UpdateService', () => {
  it('stays disabled in dev (not packaged)', () => {
    expect(updateService.getStatus().phase).toBe('disabled')
  })

  it('registers lifecycle handlers in packaged builds', () => {
    appIsPackaged.value = true
    updateService.init(() => windowMock as never)
    const names = Object.keys(eventHandlers())
    expect(names).toContain('checking-for-update')
    expect(names).toContain('update-available')
    expect(names).toContain('update-not-available')
    expect(names).toContain('download-progress')
    expect(names).toContain('update-downloaded')
    expect(names).toContain('error')
  })

  it('check() calls checkForUpdates only when enabled', () => {
    appIsPackaged.value = true
    updateService.init(() => windowMock as never)
    updateService.check()
    expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('check() is a no-op when disabled', () => {
    updateService.check()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
  })

  it('download() only when an update is available', () => {
    appIsPackaged.value = true
    updateService.init(() => windowMock as never)
    updateService.download()
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled()

    eventHandlers()['update-available']({ version: '2.0.0' })
    updateService.download()
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('install() only when the update is downloaded', () => {
    appIsPackaged.value = true
    updateService.init(() => windowMock as never)
    updateService.install()
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()

    eventHandlers()['update-available']({ version: '2.0.0' })
    eventHandlers()['update-downloaded']({ version: '2.0.0' })
    updateService.install()
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('drives the status state machine and broadcasts to the renderer', () => {
    appIsPackaged.value = true
    updateService.init(() => windowMock as never)

    const phaseOf = (n: number): UpdatePhase => webContentsSend.mock.calls[n]?.[1]?.phase

    eventHandlers()['checking-for-update']()
    expect(updateService.getStatus().phase).toBe('checking')
    expect(phaseOf(0)).toBe('checking')

    eventHandlers()['update-available']({ version: '2.0.0' })
    expect(updateService.getStatus()).toMatchObject({ phase: 'available', version: '2.0.0' })
    expect(phaseOf(1)).toBe('available')

    eventHandlers()['download-progress']({ percent: 42 })
    expect(updateService.getStatus()).toMatchObject({ phase: 'downloading', percent: 42 })

    eventHandlers()['update-downloaded']({ version: '2.0.0' })
    expect(updateService.getStatus().phase).toBe('downloaded')
  })

  it('reports errors with a message', () => {
    appIsPackaged.value = true
    updateService.init(() => windowMock as never)
    eventHandlers()['error'](new Error('feed unreachable'))
    expect(updateService.getStatus()).toMatchObject({ phase: 'error', message: 'feed unreachable' })
  })
})
