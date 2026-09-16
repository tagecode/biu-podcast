import { describe, expect, it } from 'vitest'

import { dateLocaleFromLang, formatDate, formatFileSize } from './format'

describe('dateLocaleFromLang', () => {
  it('maps en* to en-US and everything else to zh-CN', () => {
    expect(dateLocaleFromLang('en')).toBe('en-US')
    expect(dateLocaleFromLang('en-GB')).toBe('en-US')
    expect(dateLocaleFromLang('zh')).toBe('zh-CN')
    expect(dateLocaleFromLang('zh-CN')).toBe('zh-CN')
    expect(dateLocaleFromLang(undefined)).toBe('zh-CN')
  })
})

describe('formatDate', () => {
  const ts = Date.UTC(2024, 0, 15)

  it('uses zh-CN by default', () => {
    expect(formatDate(ts)).toMatch(/2024/)
    expect(formatDate(ts, 'zh')).toBe(formatDate(ts, 'zh-CN'))
  })

  it('differs between zh and en', () => {
    expect(formatDate(ts, 'zh')).not.toBe(formatDate(ts, 'en'))
  })
})

describe('formatFileSize', () => {
  it('keeps the -- placeholder', () => {
    expect(formatFileSize(null)).toBe('--')
    expect(formatFileSize(0)).toBe('--')
  })
})
