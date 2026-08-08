import {
  Tray,
  Menu,
  nativeImage,
  app,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PlaybackCommand } from '@shared/ipc-contract'
import { t } from '../i18n'

/** Module-level tray instance so IPC handlers can rebuild it on language change. */
let trayInstance: AppTray | null = null

export function setTrayInstance(tray: AppTray | null): void {
  trayInstance = tray
}

export function getTrayInstance(): AppTray | null {
  return trayInstance
}

/**
 * System tray icon + menu. Controls playback via the same main→renderer
 * command channel as global shortcuts, and can show/hide the window.
 */
export class AppTray {
  private tray: Tray | null = null
  private iconPath: string
  private readonly getWindow: () => BrowserWindow | null

  constructor(getWindow: () => BrowserWindow | null, iconPath: string) {
    this.getWindow = getWindow
    this.iconPath = iconPath
  }

  create(): void {
    const icon = nativeImage.createFromPath(this.iconPath)
    if (icon.isEmpty()) return
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))

    this.buildMenu()

    // Click on tray (Windows) → show window.
    this.tray.on('click', () => this.showWindow())
  }

  /** Rebuild the context menu (e.g. after the UI language changed). */
  rebuild(): void {
    this.buildMenu()
  }

  private showWindow(): void {
    const window = this.getWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  private buildMenu(): void {
    const send = (command: PlaybackCommand): void => {
      const window = this.getWindow()
      if (!window || window.isDestroyed()) return
      window.webContents.send(IPC_CHANNELS.playback.command, command)
    }

    const template: MenuItemConstructorOptions[] = [
      { label: t('tray.showWindow'), click: () => this.showWindow() },
      { type: 'separator' },
      { label: t('tray.playPause'), click: () => send('toggle') },
      { label: t('tray.previous'), click: () => send('previous') },
      { label: t('tray.next'), click: () => send('next') },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => app.quit() }
    ]

    this.tray?.setContextMenu(Menu.buildFromTemplate(template))
    this.tray?.setToolTip(t('tray.tooltip'))
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
