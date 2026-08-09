import { describe, expect, it } from 'vitest'

import { clampTimestamp, linkifyTimestamps, parseTimestamp } from './timestamp-link'

describe('linkifyTimestamps', () => {
  it('wraps mm:ss timestamps in clickable buttons', () => {
    const out = linkifyTimestamps('<p>Jump to 12:34 now</p>')
    expect(out).toContain('<button type="button" data-ts="754" class="ts-link">12:34</button>')
  })

  it('wraps h:mm:ss timestamps with correct seconds', () => {
    const out = linkifyTimestamps('<p>Chapter at 1:02:03</p>')
    expect(out).toContain('<button type="button" data-ts="3723" class="ts-link">1:02:03</button>')
  })

  it('does not touch timestamps inside href attributes', () => {
    const out = linkifyTimestamps('<a href="https://example.com/watch?v=12:34">link</a>')
    expect(out).toContain('href="https://example.com/watch?v=12:34"')
    expect(out).not.toContain('data-ts')
  })

  it('skips timestamps inside tag content (attributes/self-closing)', () => {
    const out = linkifyTimestamps('<img src="x.png" data-x="1:23:45">after 6:07</img>')
    expect(out).toContain('data-x="1:23:45"')
    expect(out).toContain('after <button type="button" data-ts="367" class="ts-link">6:07</button>')
  })

  it('handles multiple timestamps across a paragraph', () => {
    const out = linkifyTimestamps('<p>00:10 and 1:00:00</p>')
    expect(out).toContain('data-ts="10"')
    expect(out).toContain('data-ts="3600"')
  })

  it('returns null for empty input', () => {
    expect(linkifyTimestamps(null)).toBeNull()
    expect(linkifyTimestamps('')).toBeNull()
  })
})

describe('parseTimestamp', () => {
  it('parses mm:ss', () => {
    expect(parseTimestamp('12:34')).toBe(754)
  })

  it('parses h:mm:ss', () => {
    expect(parseTimestamp('1:02:03')).toBe(3723)
  })

  it('rejects invalid formats', () => {
    expect(parseTimestamp('abc')).toBeNull()
    expect(parseTimestamp('12:345')).toBeNull()
    expect(parseTimestamp('')).toBeNull()
  })
})

describe('clampTimestamp', () => {
  it('clamps above the duration to the duration', () => {
    expect(clampTimestamp(900, 600)).toBe(600)
  })

  it('keeps in-range timestamps unchanged', () => {
    expect(clampTimestamp(300, 600)).toBe(300)
  })

  it('clamps negatives to zero', () => {
    expect(clampTimestamp(-5, 600)).toBe(0)
  })

  it('passes through when the duration is unknown', () => {
    expect(clampTimestamp(900, null)).toBe(900)
    expect(clampTimestamp(900, undefined)).toBe(900)
    expect(clampTimestamp(900, 0)).toBe(900)
  })
})
