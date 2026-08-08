import { BrowserWindow, app } from 'electron'

/** Returns false when this process should exit because another instance owns the lock. */
export function ensureSingleInstance(
  getMainWindow: () => BrowserWindow | null,
  onSecondInstance?: (argv: string[]) => void
): boolean {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', (_event, argv) => {
    const window = getMainWindow()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    }
    // Route a deep link carried by the second instance's argv.
    if (onSecondInstance) onSecondInstance(argv)
  })

  return true
}
