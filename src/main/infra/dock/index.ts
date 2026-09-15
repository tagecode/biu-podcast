import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { MediaSessionUpdate } from '@shared/ipc-contract'
import { resolveMainLanguage, translate, type MainLanguage, type MessageKey } from '../i18n'

export type DockMenuState = Pick<
  MediaSessionUpdate,
  'title' | 'artist' | 'positionSec' | 'playing'
> | null

let state: DockMenuState = null
let getWindow: () => BrowserWindow | null = () => null

export function buildDockMenuTemplate(
  current: DockMenuState,
  language: MainLanguage = 'zh'
): MenuItemConstructorOptions[] {
  const tr = (key: MessageKey): string => translate(language, key)
  const show: MenuItemConstructorOptions = {
    id: 'show',
    label: tr('dock.showWindow'),
    click: () => showMainWindow()
  }
  if (!current) return [show]
  return [
    { id: 'nowPlaying', label: `${current.title} — ${current.artist}`, enabled: false },
    {
      id: 'toggle',
      label: current.playing ? tr('dock.pause') : tr('dock.play'),
      click: () => sendCommand('toggle')
    },
    { id: 'previous', label: tr('dock.previous'), click: () => sendCommand('previous') },
    { id: 'next', label: tr('dock.next'), click: () => sendCommand('next') },
    { type: 'separator' },
    show
  ]
}

function sendCommand(command: 'toggle' | 'previous' | 'next'): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC_CHANNELS.playback.command, command)
}

function showMainWindow(): void {
  const win = getWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function applyDockMenu(): void {
  if (process.platform !== 'darwin' || !app.dock) return
  app.dock.setMenu(Menu.buildFromTemplate(buildDockMenuTemplate(state, resolveMainLanguage())))
}

export function installDockMenu(resolveWindow: () => BrowserWindow | null): void {
  getWindow = resolveWindow
  applyDockMenu()
}

export function setDockMenuState(next: DockMenuState): void {
  state = next
  applyDockMenu()
}
