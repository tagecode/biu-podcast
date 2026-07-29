import { BrowserWindow, app } from 'electron'

/** Returns false when this process should exit because another instance owns the lock. */
export function ensureSingleInstance(getMainWindow: () => BrowserWindow | null): boolean {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', () => {
    const window = getMainWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })

  return true
}
