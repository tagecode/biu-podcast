import { XMLParser } from 'fast-xml-parser'

/** A single subscription entry parsed from OPML. */
export interface OpmlOutline {
  title: string
  feedUrl: string
  /** Nested category path, e.g. ['技术', '前端'] (empty when flat). */
  categories: string[]
}

/**
 * Parse an OPML 1.0/2.0 document into subscription outlines.
 * Handles nested <outline> structures (categories); only outlines with an
 * `xmlUrl` (an RSS feed) are returned.
 */
export function parseOpml(xml: string): OpmlOutline[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'outline'
  })
  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch {
    throw new Error('无法解析 OPML 文件，请确认格式正确')
  }

  const body = (doc as { opml?: { body?: unknown } })?.opml?.body
  if (!body) {
    throw new Error('OPML 文件缺少 body 节点')
  }

  const outlines = body as Record<string, unknown>
  const result: OpmlOutline[] = []
  collectOutlines(outlines.outline, [], result)
  return result
}

interface OutlineNode {
  '@_text'?: string
  '@_title'?: string
  '@_xmlUrl'?: string
  '@_htmlUrl'?: string
  outline?: OutlineNode[]
}

function collectOutlines(nodes: unknown, categories: string[], result: OpmlOutline[]): void {
  if (!nodes) return
  const list = Array.isArray(nodes) ? nodes : [nodes]
  for (const node of list) {
    const outline = node as OutlineNode
    const title = outline['@_text'] ?? outline['@_title'] ?? ''
    const feedUrl = outline['@_xmlUrl']
    if (feedUrl) {
      result.push({ title: title.trim(), feedUrl: feedUrl.trim(), categories: [...categories] })
    }
    // Nested outlines → deeper category path.
    collectOutlines(outline.outline, feedUrl ? categories : [...categories, title], result)
  }
}

/**
 * Serialize subscriptions to an OPML 1.0 document.
 * Flat list; categories are kept when provided (outline nesting is not
 * reconstructed — group info is preserved in the title/path only).
 */
export function buildOpml(feeds: Array<{ title: string; feedUrl: string }>): string {
  const outlines = feeds
    .map(
      (feed) =>
        `    <outline text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" type="rss" xmlUrl="${escapeXml(feed.feedUrl)}" />`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>博播 BiuPodcast 订阅</title>
  </head>
  <body>
${outlines}
  </body>
</opml>
`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
