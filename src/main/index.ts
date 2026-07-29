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
import { applyContentSecurityPolicy } from './infra/security/csp'

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

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: '博播 BiuPodcast',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

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
  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.biupodcast.app')

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
