import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Screenshot helper: serves a podcast feed + pre-generated brand-color cover
 * images (assets/screenshots/covers/) so README screenshots look like a real
 * product. Covers are generated once via sharp and committed to the repo.
 */

const COVERS_DIR = join(__dirname, '..', '..', 'assets', 'screenshots', 'covers')

export interface ScreenshotFeed {
  podcastTitle: string
  podcastAuthor: string
  coverFile: string // e.g. 'cover-0.png'
  episodes: Array<{ title: string; daysAgo: number; minutes: number }>
}

export async function startScreenshotServer(
  feed: ScreenshotFeed
): Promise<{ url: string; feedUrl: string; close: () => Promise<void> }> {
  const coverPng = readFileSync(join(COVERS_DIR, feed.coverFile))
  let feedXml = ''

  const server: Server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (path === '/feed.xml') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' })
      res.end(feedXml)
      return
    }
    if (path === '/cover.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(coverPng)
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('nope')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const port = (server.address() as AddressInfo).port
  const url = `http://127.0.0.1:${port}`

  const items = feed.episodes
    .map((ep, i) => {
      const d = new Date()
      d.setDate(d.getDate() - ep.daysAgo)
      const mins = ep.minutes
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const dur = h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}:00`
      return `    <item>
      <title>${ep.title}</title>
      <guid>shot-${i}</guid>
      <pubDate>${d.toUTCString()}</pubDate>
      <enclosure url="${url}/audio/ep${i}.mp3" length="2048" type="audio/mpeg" />
      <itunes:duration>${dur}</itunes:duration>
      <description><![CDATA[<p>${ep.title} 的完整节目简介，支持<strong>富文本</strong>展示。</p>]]></description>
    </item>`
    })
    .join('\n')

  feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${feed.podcastTitle}</title>
    <description>品牌色封面的示例播客，用于产品截图。</description>
    <language>zh-cn</language>
    <itunes:author>${feed.podcastAuthor}</itunes:author>
    <itunes:image href="${url}/cover.png" />
${items}
  </channel>
</rss>`

  return {
    url,
    feedUrl: `${url}/feed.xml`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}
