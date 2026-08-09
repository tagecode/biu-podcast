import type { Chapter } from '@shared/types'

/**
 * Parse a podcast chapters JSON document (podcast-namespace / PSC spec):
 * `{ "version": "1.2.0", "chapters": [ { "startTime": 0, "title": "Intro" }, ... ] }`.
 * startTime is in seconds; returns chapters sorted by startTime with invalid
 * entries dropped.
 */
export function parseChaptersJson(json: string): Chapter[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }

  if (!parsed || typeof parsed !== 'object') return []
  const list = (parsed as { chapters?: unknown }).chapters
  if (!Array.isArray(list)) return []

  const chapters: Chapter[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const { startTime, title } = entry as { startTime?: unknown; title?: unknown }
    if (typeof startTime !== 'number' || !Number.isFinite(startTime) || startTime < 0) continue
    if (typeof title !== 'string' || !title.trim()) continue
    chapters.push({ startTime, title: title.trim() })
  }
  return chapters.sort((a, b) => a.startTime - b.startTime)
}
