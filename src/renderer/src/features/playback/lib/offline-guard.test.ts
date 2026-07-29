import { describe, expect, it } from 'vitest'

import { canPlayEpisode } from './offline-guard'

describe('canPlayEpisode', () => {
  it('allows downloaded episodes offline', () => {
    expect(canPlayEpisode({ isDownloaded: true }, false)).toEqual({ ok: true })
  })

  it('allows undownloaded episodes online', () => {
    expect(canPlayEpisode({ isDownloaded: false }, true)).toEqual({ ok: true })
  })

  it('blocks undownloaded episodes offline', () => {
    expect(canPlayEpisode({ isDownloaded: false }, false)).toEqual({
      ok: false,
      message: '当前无网络且未下载，请先下载或联网播放'
    })
  })
})
