import Parser from 'rss-parser'

import { AppError } from '@shared/errors'
import type { ParsedFeed, ParsedFeedEpisode } from '@shared/types'

import { htmlToPlainText } from '../../infra/sanitize/html'

const parser = new Parser({
  customFields: {
    item: [
      ['enclosure', 'enclosures', { keepArray: true }],
      'itunes:duration',
      ['podcast:chapters', 'podcastChapters'],
      ['psc:chapters', 'pscChapters']
    ]
  }
})

const FETCH_TIMEOUT_MS = 60000

function parseDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value !== 'string') return null
  const parts = value.split(':').map(Number)
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}

interface EnclosureLike {
  url?: string
  type?: string
  length?: string | number
}

/**
 * Pick the most suitable audio enclosure from an item's enclosures. The RSS
 * spec allows one `<enclosure>`, but some feeds publish several (mirrors or
 * alternate qualities). rss-parser wraps keepArray fields in `$`, so each
 * entry here is `{ $: EnclosureLike }`.
 */
function pickEnclosure(item: Parser.Item): EnclosureLike | null {
  const raw = item as Parser.Item & { enclosures?: Array<{ $: EnclosureLike }> }
  const wrapped = raw.enclosures?.length ? raw.enclosures : []
  const enclosures = wrapped.map((e) => e.$).filter((e): e is EnclosureLike => Boolean(e?.url))
  if (enclosures.length === 0) {
    // Fall back to the plain `enclosure` field (single-enclosure feeds).
    const single = item.enclosure
    return single?.url ? single : null
  }

  const score = (e: EnclosureLike): number => {
    const type = (e.type ?? '').toLowerCase()
    let s = 0
    if (/audio\/mpe?g|audio\/mp3/.test(type)) s += 2
    if (Number(e.length ?? 0) > 0) s += 1
    return s
  }
  // Prefer higher score; break ties by larger byte length (usually higher
  // quality) so mirrors / multiple audio enclosures resolve deterministically.
  const sorted = [...enclosures].sort((a, b) => {
    const scoreDiff = score(b) - score(a)
    if (scoreDiff !== 0) return scoreDiff
    return Number(b.length ?? 0) - Number(a.length ?? 0)
  })
  return sorted[0] ?? null
}

function toEpisode(item: Parser.Item): ParsedFeedEpisode | null {
  const enclosure = pickEnclosure(item)
  const audioUrl = enclosure?.url ?? null
  if (!audioUrl) return null

  const publishedAt = item.isoDate ? Date.parse(item.isoDate) : Date.now()
  const durationSec = parseDuration(
    (item as Parser.Item & { itunes?: { duration?: string } }).itunes?.duration ?? null
  )
  const fileSizeBytes =
    typeof enclosure?.length === 'string'
      ? Number.parseInt(enclosure.length, 10) || null
      : typeof enclosure?.length === 'number'
        ? enclosure.length
        : null

  // podcast:chapters / psc:chapters reference a JSON file with chapter list.
  // The URL lives in the `url` attribute of the element (rss-parser exposes
  // element attributes as `$`), or as raw text content in loose feeds.
  const raw = item as Parser.Item & {
    podcastChapters?: unknown
    pscChapters?: unknown
  }
  const chaptersRef = raw.podcastChapters ?? raw.pscChapters
  const chaptersUrl = extractChaptersUrl(chaptersRef)

  return {
    title: item.title?.trim() || '未命名集数',
    descriptionHtml: truncateHtml(item.content ?? item.contentSnippet ?? item.summary ?? null),
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    audioUrl,
    durationSec,
    fileSizeBytes,
    guid: item.guid ?? item.link ?? audioUrl,
    chaptersUrl
  }
}

function extractChaptersUrl(ref: unknown): string | null {
  if (typeof ref === 'string' && ref.trim()) return ref.trim()
  if (ref && typeof ref === 'object') {
    const obj = ref as { $?: { url?: unknown }; url?: unknown }
    const attr = obj.$?.url ?? obj.url
    if (typeof attr === 'string' && attr.trim()) return attr.trim()
  }
  return null
}

function truncateHtml(html: string | null, maxChars = 4000): string | null {
  if (!html) return null
  if (html.length <= maxChars) return html
  return `${html.slice(0, maxChars)}…`
}

export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedFeed> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BiuPodcast/1.0 (+https://github.com/tagecode/biu-podcast)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    })

    if (response.status === 404) {
      throw new AppError('NOT_FOUND', '该订阅源已失效（404），请检查地址是否正确')
    }
    if (!response.ok) {
      throw new AppError('NETWORK_ERROR', `拉取 Feed 失败（HTTP ${response.status}），请稍后重试`)
    }

    const xml = await response.text()
    const feed = await parser.parseString(xml)
    const episodes = (feed.items ?? [])
      .map(toEpisode)
      .filter((item): item is ParsedFeedEpisode => item !== null)

    return {
      title: feed.title?.trim() || '未命名播客',
      description: htmlToPlainText(feed.description ?? feed.itunes?.summary ?? null),
      coverUrl: feed.itunes?.image ?? feed.image?.url ?? null,
      author: feed.itunes?.author ?? feed.creator ?? null,
      language: feed.language ?? null,
      episodes
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('TIMEOUT', '请求超时，请检查网络连接后重试')
    }
    if (
      error instanceof Error &&
      /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)
    ) {
      throw new AppError('NETWORK_ERROR', '当前无网络，无法添加新订阅')
    }
    throw new AppError('PARSE_ERROR', '无法解析该 RSS Feed，请确认地址是否正确')
  } finally {
    clearTimeout(timeout)
  }
}

export function parseFeedXml(xml: string): Promise<ParsedFeed> {
  return parser.parseString(xml).then((feed) => ({
    title: feed.title?.trim() || '未命名播客',
    description: htmlToPlainText(feed.description ?? feed.itunes?.summary ?? null),
    coverUrl: feed.itunes?.image ?? feed.image?.url ?? null,
    author: feed.itunes?.author ?? feed.creator ?? null,
    language: feed.language ?? null,
    episodes: (feed.items ?? [])
      .map(toEpisode)
      .filter((item): item is ParsedFeedEpisode => item !== null)
  }))
}
