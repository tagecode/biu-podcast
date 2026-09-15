import { describe, expect, it, vi } from 'vitest'

import { toContextMenuTemplate } from './index'

describe('toContextMenuTemplate', () => {
  it('maps edit ids to native roles', () => {
    expect(toContextMenuTemplate([{ id: 'copy', label: '复制' }])).toEqual([
      { id: 'copy', role: 'copy', label: '复制' }
    ])
  })

  it('keeps business actions as click items', () => {
    const onPick = vi.fn()
    const [item] = toContextMenuTemplate([{ id: 'episode.copyLink', label: '复制链接' }], onPick)
    item.click?.({} as never, {} as never, {} as never)
    expect(onPick).toHaveBeenCalledWith('episode.copyLink')
  })
})
