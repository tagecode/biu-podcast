import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import type { ContextMenuItem } from '@shared/ipc-contract'

const EDIT_ROLES = new Set(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])

export function toContextMenuTemplate(
  items: ContextMenuItem[],
  onPick: (id: string) => void = () => undefined
): MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (EDIT_ROLES.has(item.id)) {
      return {
        id: item.id,
        label: item.label,
        role: item.id as 'cut' | 'copy' | 'paste' | 'selectAll' | 'undo' | 'redo',
        enabled: item.enabled
      }
    }
    return { id: item.id, label: item.label, enabled: item.enabled, click: () => onPick(item.id) }
  })
}

export async function showNativeContextMenu(
  window: BrowserWindow | null,
  items: ContextMenuItem[],
  position: { x?: number; y?: number } = {}
): Promise<string | null> {
  if (!window || window.isDestroyed()) return null
  return new Promise((resolve) => {
    let settled = false
    const done = (id: string | null): void => {
      if (settled) return
      settled = true
      resolve(id)
    }
    const menu = Menu.buildFromTemplate(toContextMenuTemplate(items, done))
    menu.popup({ window, x: position.x, y: position.y, callback: () => done(null) })
  })
}
