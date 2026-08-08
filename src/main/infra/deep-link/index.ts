import { app, type BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import { AppError } from '@shared/errors'

import { findDeepLinkInArgs, parseDeepLink } from './parse'

/**
 * Register the `biu-podcast://` scheme as the default protocol client and
 * route incoming deep links to the renderer.
 *
 * - macOS delivers links via the `open-url` event.
 * - Windows/Linux deliver them as argv of the (possibly second) instance.
 */
export function setupDeepLink(getWindow: () => BrowserWindow | null): void {
  // Make this app the handler for biu-podcast:// (installs registry entry on
  // Windows, CFBundleURLTypes on macOS — see electron-builder protocols too).
  app.setAsDefaultProtocolClient('biu-podcast')

  // macOS
  app.on('open-url', (event, url) => {
    event.preventDefault()
    routeDeepLinkUrl(url, getWindow)
  })

  // Windows/Linux: a first launch may carry the URL in argv.
  const argvLink = findDeepLinkInArgs(process.argv)
  if (argvLink) {
    routeDeepLinkUrl(argvLink, getWindow)
  }
}

/** Route a deep link carried by a second instance's argv. */
export function routeDeepLinkArgv(argv: string[], getWindow: () => BrowserWindow | null): void {
  const link = findDeepLinkInArgs(argv)
  if (link) routeDeepLinkUrl(link, getWindow)
}

function routeDeepLinkUrl(rawUrl: string, getWindow: () => BrowserWindow | null): void {
  let action
  try {
    action = parseDeepLink(rawUrl)
  } catch (error) {
    console.warn('[deep-link] rejected:', error instanceof AppError ? error.message : error)
    return
  }
  const window = getWindow()
  if (!window || window.isDestroyed()) {
    console.warn('[deep-link] no window to route', action)
    return
  }
  if (action.type === 'subscribe') {
    window.webContents.send(IPC_CHANNELS.subscription.deepLinkSubscribe, action.feedUrl)
  } else if (action.type === 'play') {
    window.webContents.send(IPC_CHANNELS.playback.deepLinkPlay, action.episodeId)
  }
  // type === 'open' → just bring the app to front (already focused on launch).
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

export { findDeepLinkInArgs, parseDeepLink }
