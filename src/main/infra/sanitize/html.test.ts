import { describe, expect, it } from 'vitest'

import { htmlToPlainText } from './html'

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
