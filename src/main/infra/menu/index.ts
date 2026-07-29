import { Menu, shell, type MenuItemConstructorOptions } from 'electron'

export function buildMenuTemplate(platform: NodeJS.Platform): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: '博播',
      submenu: [
        { role: 'about', label: '关于博播' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏博播' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出博播' }
      ]
    })
  }

  template.push({
    label: '文件',
    submenu: isMac ? [{ role: 'close', label: '关闭窗口' }] : [{ role: 'quit', label: '退出' }]
  })

  template.push({
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' }
    ]
  })

  template.push({
    label: '视图',
    submenu: [
      { role: 'reload', label: '重新加载' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'resetZoom', label: '实际大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '切换全屏' }
    ]
  })

  template.push({
    label: '窗口',
    submenu: [
      { role: 'minimize', label: '最小化' },
      { role: 'close', label: '关闭' },
      ...(isMac
        ? ([
            { type: 'separator' as const },
            { role: 'front' as const, label: '全部置于顶层' }
          ] as const)
        : [])
    ]
  })

  template.push({
    label: '帮助',
    submenu: [
      {
        label: '了解博播',
        click: (): void => {
          void shell.openExternal('https://github.com/tagecode/biu-podcast')
        }
      }
    ]
  })

  return template
}

export function createApplicationMenu(platform: NodeJS.Platform = process.platform): Menu {
  return Menu.buildFromTemplate(buildMenuTemplate(platform))
}

export function installApplicationMenu(): void {
  Menu.setApplicationMenu(createApplicationMenu())
}
