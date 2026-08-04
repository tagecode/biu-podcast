import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'

export interface TestPodcastFixture {
  title: string
  author?: string
  description?: string
  language?: string
}

export interface TestEpisodeFixture {
  title: string
  audioBytes: number
  publishedDaysAgo: number
  durationSec: number
}

export interface TestServerOptions {
  /** Episode index whose audio streams slowly (to hold a task in 'downloading'). */
  slowEpisodeIndex?: number
  /** Delay between chunks when streaming the slow episode, ms. */
  slowChunkDelayMs?: number
  /** Chunk size for slow streaming, bytes. */
  slowChunkSize?: number
}

export interface TestServer {
  url: string
  feedUrl: string
  audioUrl: (index: number) => string
  /** Number of Range requests received for any audio file (proves resume). */
  rangeRequestCount: () => number
  close: () => Promise<void>
}

/**
 * Minimal MP3 bytes: an ID3 tag header + padding. Enough for Electron's audio
 * element to fire loadedmetadata (duration) without decoding real audio.
 */
function makeMp3(bytes: number): Buffer {
  const header = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'latin1')
  const body = Buffer.alloc(Math.max(bytes - header.length, 0), 0x00)
  return Buffer.concat([header, body])
}

function parseRange(
  header: string | undefined,
  total: number
): { start: number; end: number } | null {
  if (!header) return null
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : total - 1
  if (start >= total) return null
  return { start, end: Math.min(end, total - 1) }
}

/**
 * Start a local HTTP server serving a podcast RSS feed + tiny MP3 files, so
 * the add → browse → play → download journey runs hermetically in CI without
 * touching the internet. Supports Range (resume) and slow streaming (to hold a
 * task mid-download across a force-quit).
 */
export async function startTestServer(
  podcast: TestPodcastFixture,
  episodes: TestEpisodeFixture[],
  options: TestServerOptions = {}
): Promise<TestServer> {
  const audioBuffers = episodes.map((ep) => makeMp3(ep.audioBytes))
  const slowIdx = options.slowEpisodeIndex ?? -1
  const slowDelay = options.slowChunkDelayMs ?? 150
  const slowChunk = options.slowChunkSize ?? 16 * 1024
  let rangeRequests = 0

  let feedXml = ''
  const server: Server = createServer((req, res) => {
    handleRequest(req, res)
  })

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (path === '/feed.xml') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' })
      res.end(feedXml)
      return
    }
    if (path === '/cover.jpg') {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' })
      res.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
      return
    }
    const audioMatch = /^\/audio\/ep(\d+)\.mp3$/.exec(path)
    if (audioMatch) {
      const idx = Number(audioMatch[1])
      if (idx < audioBuffers.length) {
        await serveAudio(req, res, audioBuffers[idx], idx)
        return
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('not found')
  }

  async function serveAudio(
    req: IncomingMessage,
    res: ServerResponse,
    buffer: Buffer,
    idx: number
  ): Promise<void> {
    const total = buffer.length
    const range = parseRange(req.headers.range, total)
    const start = range?.start ?? 0
    const end = range?.end ?? total - 1
    const slice = buffer.subarray(start, end + 1)

    if (range) {
      rangeRequests += 1
      res.writeHead(206, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(slice.length),
        'Content-Range': `bytes ${start}-${end}/${total}`
      })
    } else {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(total)
      })
    }

    if (idx === slowIdx) {
      // Stream slowly so the task stays 'downloading' — enables force-quit tests.
      for (let offset = 0; offset < slice.length; offset += slowChunk) {
        if (!res.writableEnded && res.writable) {
          res.write(slice.subarray(offset, offset + slowChunk))
          await new Promise((r) => setTimeout(r, slowDelay))
        }
      }
      res.end()
    } else {
      res.end(slice)
    }
  }

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const port = (server.address() as AddressInfo).port
  const url = `http://127.0.0.1:${port}`
  feedXml = buildFeedXml(podcast, episodes, url)

  return {
    url,
    feedUrl: `${url}/feed.xml`,
    audioUrl: (index) => `${url}/audio/ep${index}.mp3`,
    rangeRequestCount: () => rangeRequests,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

function buildFeedXml(
  podcast: TestPodcastFixture,
  episodes: TestEpisodeFixture[],
  url: string
): string {
  const items = episodes
    .map((ep, i) => {
      const date = new Date()
      date.setDate(date.getDate() - ep.publishedDaysAgo)
      const minutes = Math.floor(ep.durationSec / 60)
      const seconds = ep.durationSec % 60
      return `    <item>
      <title>${ep.title}</title>
      <guid>ep-${i}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <enclosure url="${url}/audio/ep${i}.mp3" length="${ep.audioBytes}" type="audio/mpeg" />
      <itunes:duration>${minutes}:${seconds.toString().padStart(2, '0')}</itunes:duration>
      <description><![CDATA[<p>Episode ${i} description with <b>bold</b> text.</p>]]></description>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${podcast.title}</title>
    <description>${podcast.description ?? 'A hermetic test podcast'}</description>
    <language>${podcast.language ?? 'en'}</language>
    ${podcast.author ? `<itunes:author>${podcast.author}</itunes:author>` : ''}
    <itunes:image href="${url}/cover.jpg" />
${items}
  </channel>
</rss>`
}
