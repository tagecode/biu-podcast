import { describe, expect, it } from 'vitest'

import { buildDockMenuTemplate } from './index'

function itemIds(template: ReturnType<typeof buildDockMenuTemplate>): Array<string | undefined> {
  return template.filter((item) => item.type !== 'separator').map((item) => item.id)
}

describe('buildDockMenuTemplate', () => {
  it('shows only window actions when nothing is playing', () => {
    const template = buildDockMenuTemplate(null, 'zh')
    expect(itemIds(template)).toEqual(['show'])
  })

  it('adds playback controls when media session state exists', () => {
    const template = buildDockMenuTemplate(
      { title: 'Ep', artist: 'Pod', positionSec: 1, playing: true },
      'zh'
    )
    expect(itemIds(template)).toEqual(['nowPlaying', 'toggle', 'previous', 'next', 'show'])
    expect(template.find((item) => item.id === 'toggle')?.label).toBe('暂停')
  })

  it('labels toggle as play when media is paused', () => {
    const template = buildDockMenuTemplate(
      { title: 'Ep', artist: 'Pod', positionSec: 1, playing: false },
      'zh'
    )
    expect(template.find((item) => item.id === 'toggle')?.label).toBe('播放')
  })
})
