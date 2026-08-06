import { describe, expect, it } from 'vitest'

import { buildOpml, parseOpml } from './opml'

const SAMPLE_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My subs</title></head>
  <body>
    <outline text="技术" title="技术">
      <outline text="前端周刊" type="rss" xmlUrl="https://example.com/fe.xml" />
    </outline>
    <outline text="独立播客" type="rss" xmlUrl="https://example.com/indie.xml" />
    <outline text="没有订阅的文件夹">
      <outline text="空" />
    </outline>
  </body>
</opml>`

describe('parseOpml', () => {
  it('extracts flat and nested RSS outlines', () => {
    const result = parseOpml(SAMPLE_OPML)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: '前端周刊',
      feedUrl: 'https://example.com/fe.xml',
      categories: ['技术']
    })
    expect(result[1]).toEqual({
      title: '独立播客',
      feedUrl: 'https://example.com/indie.xml',
      categories: []
    })
  })

  it('throws on invalid xml', () => {
    // fast-xml-parser tolerates some non-XML input; either "无法解析" (hard
    // parse failure) or "缺少 body" (parsed but not an OPML) is acceptable.
    expect(() => parseOpml('not xml')).toThrow(/无法解析 OPML|缺少 body/)
  })

  it('throws when body is missing', () => {
    expect(() => parseOpml('<opml version="2.0"><head></head></opml>')).toThrow('缺少 body')
  })
})

describe('buildOpml', () => {
  it('serializes feeds to a standard OPML document', () => {
    const xml = buildOpml([
      { title: '播客 A', feedUrl: 'https://a.example/feed.xml' },
      { title: '播客 B', feedUrl: 'https://b.example/feed.xml' }
    ])
    expect(xml).toContain('<?xml version="1.0"')
    expect(xml).toContain('<opml version="2.0">')
    expect(xml).toContain('type="rss" xmlUrl="https://a.example/feed.xml"')
    expect(xml).toContain('type="rss" xmlUrl="https://b.example/feed.xml"')
    // Round-trips back to the same feeds.
    const parsed = parseOpml(xml)
    expect(parsed).toHaveLength(2)
    expect(parsed.map((p) => p.feedUrl)).toEqual([
      'https://a.example/feed.xml',
      'https://b.example/feed.xml'
    ])
  })

  it('escapes XML special characters in titles', () => {
    const xml = buildOpml([{ title: 'A & B <Podcast>', feedUrl: 'https://x/feed.xml' }])
    expect(xml).toContain('A &amp; B &lt;Podcast&gt;')
  })
})
