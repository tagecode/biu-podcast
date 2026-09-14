import { describe, expect, it } from 'vitest'

import { resolveCoverUrl } from './cover-url'

describe('resolveCoverUrl', () => {
  it('prefers the local cache via biu-media', () => {
    expect(
      resolveCoverUrl({
        coverUrl: 'https://cdn.example.com/a.jpg',
        coverLocalPath: 'C:\\data\\covers\\pod-1.jpg'
      })
    ).toBe(`biu-media://local/?path=${encodeURIComponent('C:\\data\\covers\\pod-1.jpg')}`)
  })

  it('falls back to the remote url, then to null', () => {
    expect(resolveCoverUrl({ coverUrl: 'https://cdn.example.com/a.jpg' })).toBe(
      'https://cdn.example.com/a.jpg'
    )
    expect(resolveCoverUrl({ coverUrl: null })).toBeNull()
  })
})
