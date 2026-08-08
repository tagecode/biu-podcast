import { app } from 'electron'

import { settingsStore } from '../settings/store'

type Language = 'zh' | 'en'

/**
 * Lightweight main-process localization for user-visible strings (application
 * menu, tray menu, system notifications). The renderer owns the full i18n
 * resources; here we only need the handful of strings the main process shows.
 *
 * The dictionary is typed so a missing key is a compile error.
 */
const messages = {
  zh: {
    'menu.file': '文件',
    'menu.edit': '编辑',
    'menu.view': '视图',
    'menu.window': '窗口',
    'menu.help': '帮助',
    'menu.about': '关于博播',
    'menu.hide': '隐藏博播',
    'menu.hideOthers': '隐藏其他',
    'menu.unhide': '全部显示',
    'menu.quit': '退出博播',
    'menu.closeWindow': '关闭窗口',
    'menu.quitApp': '退出',
    'menu.undo': '撤销',
    'menu.redo': '重做',
    'menu.cut': '剪切',
    'menu.copy': '复制',
    'menu.paste': '粘贴',
    'menu.selectAll': '全选',
    'menu.reload': '重新加载',
    'menu.devTools': '开发者工具',
    'menu.resetZoom': '实际大小',
    'menu.zoomIn': '放大',
    'menu.zoomOut': '缩小',
    'menu.fullscreen': '切换全屏',
    'menu.minimize': '最小化',
    'menu.close': '关闭',
    'menu.front': '全部置于顶层',
    'menu.learn': '了解博播',
    'menu.app': '博播',
    'tray.showWindow': '显示博播',
    'tray.playPause': '播放/暂停',
    'tray.previous': '上一集',
    'tray.next': '下一集',
    'tray.quit': '退出',
    'tray.tooltip': '博播 BiuPodcast',
    'notification.appName': '博播',
    'notification.newEpisodes': '发现 {{count}} 集新内容',
    'notification.downloadDone': '下载完成'
  },
  en: {
    'menu.file': 'File',
    'menu.edit': 'Edit',
    'menu.view': 'View',
    'menu.window': 'Window',
    'menu.help': 'Help',
    'menu.about': 'About BiuPodcast',
    'menu.hide': 'Hide BiuPodcast',
    'menu.hideOthers': 'Hide Others',
    'menu.unhide': 'Show All',
    'menu.quit': 'Quit BiuPodcast',
    'menu.closeWindow': 'Close Window',
    'menu.quitApp': 'Quit',
    'menu.undo': 'Undo',
    'menu.redo': 'Redo',
    'menu.cut': 'Cut',
    'menu.copy': 'Copy',
    'menu.paste': 'Paste',
    'menu.selectAll': 'Select All',
    'menu.reload': 'Reload',
    'menu.devTools': 'Developer Tools',
    'menu.resetZoom': 'Actual Size',
    'menu.zoomIn': 'Zoom In',
    'menu.zoomOut': 'Zoom Out',
    'menu.fullscreen': 'Toggle Full Screen',
    'menu.minimize': 'Minimize',
    'menu.close': 'Close',
    'menu.front': 'Bring All to Front',
    'menu.learn': 'Learn About BiuPodcast',
    'menu.app': 'BiuPodcast',
    'tray.showWindow': 'Show BiuPodcast',
    'tray.playPause': 'Play/Pause',
    'tray.previous': 'Previous',
    'tray.next': 'Next',
    'tray.quit': 'Quit',
    'tray.tooltip': 'BiuPodcast',
    'notification.appName': 'BiuPodcast',
    'notification.newEpisodes': '{{count}} new episodes found',
    'notification.downloadDone': 'Download complete'
  }
} as const

type MessageKey = keyof (typeof messages)['zh']

/** Resolve the current UI language from the persisted preference / OS locale. */
export function resolveMainLanguage(): Language {
  const pref = settingsStore.getAll().language
  if (pref === 'zh' || pref === 'en') return pref
  // Follow the OS locale. `app` is only available inside Electron; unit tests
  // run in plain Node where the electron import is a stub — fall back to zh.
  try {
    return (app.getLocale() ?? 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
  }
}

/**
 * Translate a key into the current UI language with {{var}} interpolation.
 * Reads the persisted language preference (defaulting to the OS locale).
 */
export function t(key: MessageKey, params?: Record<string, number | string>): string {
  return translate(resolveMainLanguage(), key, params)
}

/**
 * Pure translate with an explicit language — used by the application menu,
 * which is rebuilt on language change, and by tests.
 */
export function translate(
  lang: Language,
  key: MessageKey,
  params?: Record<string, number | string>
): string {
  let message: string = messages[lang][key]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replaceAll(`{{${name}}}`, String(value))
    }
  }
  return message
}

export type MainLanguage = Language
export type { MessageKey }
