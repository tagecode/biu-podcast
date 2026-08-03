import { describe, expect, it, vi, beforeEach } from 'vitest'

import { parseFeedXml, fetchAndParseFeed } from './feed-parser'

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Sample Podcast</title>
    <description>A sample feed</description>
    <itunes:author>John Doe</itunes:author>
    <itunes:image href="https://example.com/cover.jpg" />
    <language>en</language>
    <item>
      <title>Episode One</title>
      <description><![CDATA[<p>First episode</p>]]></description>
      <pubDate>Sun, 01 Jan 2023 00:00:00 GMT</pubDate>
      <guid>ep-1</guid>
      <enclosure url="https://example.com/ep1.mp3" length="1024" type="audio/mpeg" />
      <itunes:duration>10:30</itunes:duration>
    </item>
    <item>
      <title>Episode Two</title>
      <description>Second episode</description>
      <pubDate>Mon, 02 Jan 2023 00:00:00 GMT</pubDate>
      <guid>ep-2</guid>
      <enclosure url="https://example.com/ep2.mp3" length="2048" type="audio/mpeg" />
      <itunes:duration>1:02:30</itunes:duration>
    </item>
  </channel>
</rss>`

const MISSING_FIELDS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Minimal</title>
    <item>
      <title>Only Item</title>
      <enclosure url="https://example.com/x.mp3" />
    </item>
  </channel>
</rss>`

describe('parseFeedXml', () => {
  it('parses standard feed with episodes', async () => {
    const feed = await parseFeedXml(SAMPLE_FEED)
    expect(feed.title).toBe('Sample Podcast')
    expect(feed.description).toContain('sample feed')
    expect(feed.author).toBe('John Doe')
    expect(feed.coverUrl).toBe('https://example.com/cover.jpg')
    expect(feed.language).toBe('en')
    expect(feed.episodes).toHaveLength(2)
    expect(feed.episodes[0]?.title).toBe('Episode One')
    expect(feed.episodes[0]?.durationSec).toBe(630) // 10:30
    expect(feed.episodes[1]?.durationSec).toBe(3750) // 1:02:30
    expect(feed.episodes[0]?.fileSizeBytes).toBe(1024)
    expect(feed.episodes[0]?.guid).toBe('ep-1')
  })

  it('handles missing optional fields gracefully', async () => {
    const feed = await parseFeedXml(MISSING_FIELDS_FEED)
    expect(feed.title).toBe('Minimal')
    expect(feed.author).toBeNull()
    expect(feed.coverUrl).toBeNull()
    expect(feed.language).toBeNull()
    expect(feed.episodes).toHaveLength(1)
    expect(feed.episodes[0]?.durationSec).toBeNull()
    expect(feed.episodes[0]?.fileSizeBytes).toBeNull()
  })

  it('skips items without audio enclosure', async () => {
    const feed = await parseFeedXml(
      `<rss version="2.0"><channel><title>T</title>
        <item><title>No Audio</title><guid>na</guid></item>
        <item><title>Has Audio</title><guid>ha</guid><enclosure url="https://x.com/a.mp3" /></item>
      </channel></rss>`
    )
    expect(feed.episodes).toHaveLength(1)
    expect(feed.episodes[0]?.title).toBe('Has Audio')
  })
})

describe('fetchAndParseFeed', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and parses a feed from URL', async () => {
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SAMPLE_FEED
    })
    vi.stubGlobal('fetch', mockedFetch)

    const feed = await fetchAndParseFeed('https://example.com/feed.xml')
    expect(feed.title).toBe('Sample Podcast')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('throws NOT_FOUND on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' })
    )
    await expect(fetchAndParseFeed('https://example.com/404.xml')).rejects.toThrow('已失效')
  })

  it('throws NETWORK_ERROR on non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' })
    )
    await expect(fetchAndParseFeed('https://example.com/500.xml')).rejects.toThrow('拉取 Feed 失败')
  })

  it('throws PARSE_ERROR on invalid xml', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'not xml at all' })
    )
    await expect(fetchAndParseFeed('https://example.com/bad.xml')).rejects.toThrow('无法解析')
  })

  it('throws TIMEOUT on abort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((_, reject) => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
      )
    )
    await expect(fetchAndParseFeed('https://example.com/slow.xml')).rejects.toThrow('请求超时')
  })

  it('throws NETWORK_ERROR on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('fetch failed')))
    )
    await expect(fetchAndParseFeed('https://example.com/net.xml')).rejects.toThrow('无网络')
  })
})
