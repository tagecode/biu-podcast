import { describe, expect, it } from 'vitest'

import { translate } from './index'

describe('main-process i18n', () => {
  it('translates menu keys in zh', () => {
    expect(translate('zh', 'menu.file')).toBe('文件')
    expect(translate('zh', 'menu.edit')).toBe('编辑')
    expect(translate('zh', 'tray.showWindow')).toBe('显示博播')
  })

  it('translates menu keys in en', () => {
    expect(translate('en', 'menu.file')).toBe('File')
    expect(translate('en', 'menu.help')).toBe('Help')
    expect(translate('en', 'tray.quit')).toBe('Quit')
  })

  it('interpolates notification count', () => {
    expect(translate('zh', 'notification.newEpisodes', { count: 3 })).toBe('发现 3 集新内容')
    expect(translate('en', 'notification.newEpisodes', { count: 3 })).toBe('3 new episodes found')
  })

  it('zh and en expose the same keys', () => {
    // Type-level guarantee: both are keyed by MessageKey; assert a representative
    // set of keys resolves in both languages.
    const keys = [
      'menu.file',
      'menu.edit',
      'menu.view',
      'menu.window',
      'menu.help',
      'tray.showWindow',
      'tray.playPause',
      'tray.quit',
      'notification.appName',
      'notification.newEpisodes',
      'notification.downloadDone'
    ] as const
    for (const key of keys) {
      expect(translate('zh', key).length).toBeGreaterThan(0)
      expect(translate('en', key).length).toBeGreaterThan(0)
    }
  })
})
