import { app, BrowserWindow, protocol, net, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'
import { downloadService } from './features/download/download.service'
import { registerAllHandlers } from './ipc/handlers'
import { setMainWindow } from './ipc/register'
import { closeDb, getDb } from './infra/db/client'
import { migrateDatabase } from './infra/db/migrate'
import { installApplicationMenu } from './infra/menu'
import { applyContentSecurityPolicy } from './infra/security/csp'
import { createMainWindowWebPreferences } from './infra/security/web-preferences'
import { ensureSingleInstance } from './infra/window/single-instance'
import { loadWindowState, trackWindowState } from './infra/window/window-state-store'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'biu-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let mainWindowRef: BrowserWindow | null = null

if (!ensureSingleInstance(() => mainWindowRef)) {
  // Another instance owns the lock; this process is quitting.
} else {
  function createWindow(): BrowserWindow {
    const state = loadWindowState()
    const mainWindow = new BrowserWindow({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      minWidth: 960,
      minHeight: 640,
      show: false,
      autoHideMenuBar: true,
      title: '博播 BiuPodcast',
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: createMainWindowWebPreferences(join(__dirname, '../preload/index.js'))
    })

    if (state.isMaximized) {
      mainWindow.maximize()
    }

    trackWindowState(mainWindow)

    mainWindow.on('ready-to-show', () => {
      mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    setMainWindow(mainWindow)
    mainWindowRef = mainWindow
    mainWindow.on('closed', () => {
      if (mainWindowRef === mainWindow) mainWindowRef = null
    })
    return mainWindow
  }

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.biupodcast.app')
    installApplicationMenu()

    protocol.handle('biu-media', (request) => {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')
      if (!filePath) {
        return new Response('Missing path', { status: 400 })
      }
      return net.fetch(pathToFileURL(filePath).href)
    })

    applyContentSecurityPolicy()
    migrateDatabase()
    getDb()
    registerAllHandlers()
    downloadService.start()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    closeDb()
  })
}
