import sanitizeHtml from 'sanitize-html'

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&amp;/gi, '&')
}

/** Strip HTML tags and collapse whitespace into plain text for UI summaries. */
export function htmlToPlainText(input: string | null | undefined): string | null {
  if (!input) return null

  const prepared = input
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, ' ')

  const text = sanitizeHtml(prepared, {
    allowedTags: [],
    allowedAttributes: {}
  })
  const normalized = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

const RICH_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'code',
    'pre',
    'span',
    'div'
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    '*': ['class']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank'
    })
  }
}

/** Sanitize episode/podcast rich HTML for safe renderer display. */
export function sanitizeRichHtml(input: string | null | undefined): string | null {
  if (!input) return null
  const cleaned = sanitizeHtml(input, RICH_HTML_OPTIONS).trim()
  return cleaned.length > 0 ? cleaned : null
}
