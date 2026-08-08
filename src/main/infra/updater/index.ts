import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'

/** Update lifecycle phases surfaced to the settings UI. */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled'

export interface UpdateStatus {
  phase: UpdatePhase
  /** Version of the available/downloaded update. */
  version?: string
  /** Download progress (0–100) while phase === 'downloading'. */
  percent?: number
  /** Human-readable error message while phase === 'error'. */
  message?: string
}

/**
 * Wraps electron-updater behind a small state machine and pushes every state
 * change to the renderer so the settings UI can react.
 *
 * Auto-update only makes sense for packaged builds: in dev there is no update
 * feed to check, so the service stays in 'disabled'.
 */
class UpdateService {
  private status: UpdateStatus = { phase: 'idle' }
  private getWindow: () => BrowserWindow | null = () => null

  init(getWindow: () => BrowserWindow | null): void {
    this.getWindow = getWindow

    if (!this.enabled()) {
      this.status = { phase: 'disabled' }
      return
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    // electron-builder-generated update metadata lives alongside the app.
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ phase: 'checking' })
    })
    autoUpdater.on('update-available', (info) => {
      this.setStatus({ phase: 'available', version: info.version })
    })
    autoUpdater.on('update-not-available', () => {
      this.setStatus({ phase: 'not-available' })
    })
    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        phase: 'downloading',
        version: this.status.version,
        percent: Math.round(progress.percent)
      })
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({ phase: 'downloaded', version: info.version })
    })
    autoUpdater.on('error', (error) => {
      console.error('[updater] error:', error)
      this.setStatus({ phase: 'error', message: error.message })
    })
  }

  /** True when this is a packaged build (auto-update is meaningless in dev). */
  enabled(): boolean {
    return app.isPackaged
  }

  getStatus(): UpdateStatus {
    return { ...this.status }
  }

  /** Manual "check for updates" from the settings page. */
  check(): void {
    if (!this.enabled()) return
    void autoUpdater.checkForUpdates()
  }

  /** Download an available update (called from the settings UI). */
  download(): void {
    if (!this.enabled() || this.status.phase !== 'available') return
    void autoUpdater.downloadUpdate()
  }

  /** Quit, install the downloaded update and restart. */
  install(): void {
    if (!this.enabled() || this.status.phase !== 'downloaded') return
    autoUpdater.quitAndInstall()
  }

  private setStatus(status: UpdateStatus): void {
    this.status = status
    const window = this.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.update.status, this.getStatus())
    }
  }
}

export const updateService = new UpdateService()
