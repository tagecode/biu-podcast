import { describe, expect, it } from 'vitest'

import { findDeepLinkInArgs, parseDeepLink } from './parse'

describe('parseDeepLink', () => {
  it('parses an open action', () => {
    expect(parseDeepLink('biu-podcast://open')).toEqual({ type: 'open' })
    expect(parseDeepLink('biu-podcast://')).toEqual({ type: 'open' })
  })

  it('parses a subscribe action with a feed URL', () => {
    const result = parseDeepLink('biu-podcast://subscribe?url=https%3A%2F%2Fexample.com%2Ffeed.xml')
    expect(result).toEqual({ type: 'subscribe', feedUrl: 'https://example.com/feed.xml' })
  })

  it('parses a play action with an episode id', () => {
    expect(parseDeepLink('biu-podcast://play/abc123')).toEqual({
      type: 'play',
      episodeId: 'abc123'
    })
  })

  it('rejects non-biupodcast protocols', () => {
    expect(() => parseDeepLink('https://example.com')).toThrow('不是博播深链接')
  })

  it('rejects subscribe without a valid feed url', () => {
    expect(() => parseDeepLink('biu-podcast://subscribe')).toThrow('缺少有效的 RSS 地址')
    expect(() => parseDeepLink('biu-podcast://subscribe?url=javascript:alert(1)')).toThrow(
      '缺少有效的 RSS 地址'
    )
  })

  it('rejects play without an episode id', () => {
    expect(() => parseDeepLink('biu-podcast://play/')).toThrow('缺少集数 ID')
  })

  it('rejects unknown hosts', () => {
    expect(() => parseDeepLink('biu-podcast://evil/path')).toThrow('未知的深链接操作')
  })
})

describe('findDeepLinkInArgs', () => {
  it('finds a deep link in argv', () => {
    expect(findDeepLinkInArgs(['app', '--flag', 'biu-podcast://open'])).toBe('biu-podcast://open')
  })

  it('returns null when no deep link', () => {
    expect(findDeepLinkInArgs(['app', '--flag'])).toBeNull()
  })
})
