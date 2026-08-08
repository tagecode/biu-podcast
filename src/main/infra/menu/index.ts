import { Menu, shell, type MenuItemConstructorOptions } from 'electron'

import { resolveMainLanguage, translate, type MainLanguage } from '../i18n'

export function buildMenuTemplate(
  platform: NodeJS.Platform,
  language: MainLanguage = 'zh'
): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin'
  const tr = (key: Parameters<typeof translate>[1]): string => translate(language, key)
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: tr('menu.app'),
      submenu: [
        { role: 'about', label: tr('menu.about') },
        { type: 'separator' },
        { role: 'hide', label: tr('menu.hide') },
        { role: 'hideOthers', label: tr('menu.hideOthers') },
        { role: 'unhide', label: tr('menu.unhide') },
        { type: 'separator' },
        { role: 'quit', label: tr('menu.quit') }
      ]
    })
  }

  template.push({
    label: tr('menu.file'),
    submenu: isMac
      ? [{ role: 'close', label: tr('menu.closeWindow') }]
      : [{ role: 'quit', label: tr('menu.quitApp') }]
  })

  template.push({
    label: tr('menu.edit'),
    submenu: [
      { role: 'undo', label: tr('menu.undo') },
      { role: 'redo', label: tr('menu.redo') },
      { type: 'separator' },
      { role: 'cut', label: tr('menu.cut') },
      { role: 'copy', label: tr('menu.copy') },
      { role: 'paste', label: tr('menu.paste') },
      { role: 'selectAll', label: tr('menu.selectAll') }
    ]
  })

  template.push({
    label: tr('menu.view'),
    submenu: [
      { role: 'reload', label: tr('menu.reload') },
      { role: 'toggleDevTools', label: tr('menu.devTools') },
      { type: 'separator' },
      { role: 'resetZoom', label: tr('menu.resetZoom') },
      { role: 'zoomIn', label: tr('menu.zoomIn') },
      { role: 'zoomOut', label: tr('menu.zoomOut') },
      { type: 'separator' },
      { role: 'togglefullscreen', label: tr('menu.fullscreen') }
    ]
  })

  template.push({
    label: tr('menu.window'),
    submenu: [
      { role: 'minimize', label: tr('menu.minimize') },
      { role: 'close', label: tr('menu.close') },
      ...(isMac
        ? ([
            { type: 'separator' as const },
            { role: 'front' as const, label: tr('menu.front') }
          ] as const)
        : [])
    ]
  })

  template.push({
    label: tr('menu.help'),
    submenu: [
      {
        label: tr('menu.learn'),
        click: (): void => {
          void shell.openExternal('https://github.com/tagecode/biu-podcast')
        }
      }
    ]
  })

  return template
}

export function createApplicationMenu(
  platform: NodeJS.Platform = process.platform,
  language: MainLanguage = resolveMainLanguage()
): Menu {
  return Menu.buildFromTemplate(buildMenuTemplate(platform, language))
}

export function installApplicationMenu(): void {
  Menu.setApplicationMenu(createApplicationMenu(process.platform, resolveMainLanguage()))
}
