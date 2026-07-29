import { describe, expect, it } from 'vitest'

import { htmlToPlainText, sanitizeRichHtml } from './html'

describe('htmlToPlainText', () => {
  it('returns null for empty input', () => {
    expect(htmlToPlainText(null)).toBeNull()
    expect(htmlToPlainText('')).toBeNull()
    expect(htmlToPlainText('   ')).toBeNull()
  })

  it('strips tags and keeps readable text', () => {
    expect(htmlToPlainText('<p>你好 <b>世界</b></p><p>第二段</p>')).toBe('你好 世界 第二段')
  })

  it('decodes common HTML entities', () => {
    expect(htmlToPlainText('A&nbsp;&amp;&nbsp;B')).toBe('A & B')
  })

  it('passes through plain text unchanged (aside from whitespace)', () => {
    expect(htmlToPlainText('  纯文本简介  ')).toBe('纯文本简介')
  })
})

describe('sanitizeRichHtml', () => {
  it('returns null for empty input', () => {
    expect(sanitizeRichHtml(null)).toBeNull()
    expect(sanitizeRichHtml('')).toBeNull()
  })

  it('removes script tags while keeping safe markup', () => {
    const result = sanitizeRichHtml(
      '<p>安全段落</p><script>alert(1)</script><ul><li>要点</li></ul>'
    )
    expect(result).toContain('<p>安全段落</p>')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>要点</li>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert(1)')
  })

  it('strips inline event handlers and javascript urls', () => {
    const result = sanitizeRichHtml(
      '<p onclick="evil()">文字</p><a href="javascript:alert(1)">链接</a><img src="x" onerror="alert(2)">'
    )
    expect(result).not.toMatch(/onerror/i)
    expect(result).not.toMatch(/onclick/i)
    expect(result).not.toMatch(/javascript:/i)
    expect(result).toContain('文字')
  })

  it('keeps http links with safe attributes', () => {
    const result = sanitizeRichHtml('<p><a href="https://example.com">官网</a></p>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('官网')
  })
})
