import { describe, expect, it } from 'vitest'

import { buildMenuTemplate } from './index'

describe('buildMenuTemplate', () => {
  it('includes File/Edit/View/Help on Windows', () => {
    const labels = buildMenuTemplate('win32').map((item) => item.label)
    expect(labels).toEqual(['文件', '编辑', '视图', '窗口', '帮助'])
  })

  it('adds app menu on macOS', () => {
    const labels = buildMenuTemplate('darwin').map((item) => item.label)
    expect(labels[0]).toBe('博播')
    expect(labels).toContain('编辑')
    expect(labels).toContain('帮助')
  })
})
