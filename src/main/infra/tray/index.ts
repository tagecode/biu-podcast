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

/**
 * System tray icon + menu. Controls playback via the same main→renderer
 * command channel as global shortcuts, and can show/hide the window.
 */
export class AppTray {
  private tray: Tray | null = null

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly iconPath: string
  ) {}

  create(): void {
    const icon = nativeImage.createFromPath(this.iconPath)
    if (icon.isEmpty()) return
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))

    const send = (command: PlaybackCommand): void => {
      const window = this.getWindow()
      if (!window || window.isDestroyed()) return
      window.webContents.send(IPC_CHANNELS.playback.command, command)
    }

    const showWindow = (): void => {
      const window = this.getWindow()
      if (!window) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    }

    const template: MenuItemConstructorOptions[] = [
      { label: '显示博播', click: showWindow },
      { type: 'separator' },
      { label: '播放/暂停', click: () => send('toggle') },
      { label: '上一集', click: () => send('previous') },
      { label: '下一集', click: () => send('next') },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
    this.tray.setToolTip('博播 BiuPodcast')
    // Click on tray (Windows) → show window.
    this.tray.on('click', showWindow)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
