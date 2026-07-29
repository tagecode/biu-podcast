import { BrowserWindow, screen } from 'electron'
import ElectronStore from 'electron-store'

import { resolveWindowBounds, type DisplayBounds, type SavedWindowState } from './window-state'

const Store = ((ElectronStore as unknown as { default?: typeof ElectronStore }).default ??
  ElectronStore) as typeof ElectronStore

const store = new Store<{ windowState: SavedWindowState | null }>({
  name: 'window-state',
  defaults: { windowState: null }
})

const DEFAULT_SIZE = { width: 1280, height: 800 }

export function loadWindowState(): SavedWindowState {
  const displays: DisplayBounds[] = screen.getAllDisplays().map((display) => ({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height
  }))
  return resolveWindowBounds(store.get('windowState'), displays, DEFAULT_SIZE)
}

export function trackWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null

  const persist = (): void => {
    if (window.isDestroyed()) return
    const bounds = window.getBounds()
    store.set('windowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized()
    })
  }

  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(persist, 400)
  }

  window.on('resize', schedule)
  window.on('move', schedule)
  window.on('maximize', schedule)
  window.on('unmaximize', schedule)
  window.on('close', persist)
}
