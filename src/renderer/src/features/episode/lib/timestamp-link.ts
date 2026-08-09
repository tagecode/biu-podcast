/**
 * Convert `mm:ss` / `h:mm:ss` timestamps in episode description HTML into
 * clickable buttons (PRD §6.7「时间戳跳转」). Works on already-sanitized HTML:
 * only text-node positions are processed — content inside tags/attributes
 * (e.g. URLs) is never touched, so no new injection surface is introduced.
 */

/** `h:mm:ss` or `mm:ss`; anchored so digits like `123:45` don't partially match. */
const TIME_TOKEN = /(\d{1,2}):(\d{1,2}):(\d{2})|\b(\d{1,2}):(\d{2})\b/g
/** Anything that looks like a tag (start, end, or self-closing). */
const TAG_TOKEN = /<[^>]*>/g

function parseSeconds(full: string): number {
  const parts = full.split(':').map(Number)
  if (parts.some((part) => Number.isNaN(part))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] ?? 0
}

function linkifyText(text: string): string {
  return text.replace(TIME_TOKEN, (full) => {
    const seconds = parseSeconds(full)
    return `<button type="button" data-ts="${seconds}" class="ts-link">${full}</button>`
  })
}

/**
 * Replace timestamp patterns with clickable buttons, skipping anything inside
 * a tag. Input must already be sanitized HTML (see sanitizeRichHtml).
 */
export function linkifyTimestamps(html: string | null | undefined): string | null {
  if (!html) return null
  let lastIndex = 0
  const parts: string[] = []
  for (const match of html.matchAll(TAG_TOKEN)) {
    parts.push(linkifyText(html.slice(lastIndex, match.index)))
    parts.push(match[0])
    lastIndex = (match.index ?? 0) + match[0].length
  }
  parts.push(linkifyText(html.slice(lastIndex)))
  return parts.join('')
}

/** Parse a `mm:ss` / `h:mm:ss` string to seconds, or null when invalid. */
export function parseTimestamp(text: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return null
  const h = m[1] ? Number(m[1]) : 0
  return h * 3600 + Number(m[2]) * 60 + Number(m[3])
}
