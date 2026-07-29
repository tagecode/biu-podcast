import { describe, expect, it } from 'vitest'

import { messageForFeedError } from './error-messages'

describe('messageForFeedError', () => {
  it('maps known error codes', () => {
    expect(messageForFeedError('NOT_FOUND')).toContain('404')
    expect(messageForFeedError('TIMEOUT')).toContain('超时')
    expect(messageForFeedError('PARSE_ERROR')).toContain('解析')
    expect(messageForFeedError('NETWORK_ERROR')).toContain('网络')
    expect(messageForFeedError('INVALID_XML')).toContain('XML')
  })

  it('covers every fetch status alias', () => {
    const statuses = [
      'ok',
      'timeout',
      'parse_error',
      'invalid_xml',
      'not_found',
      'network_error'
    ] as const
    for (const status of statuses) {
      if (status === 'ok') continue
      expect(messageForFeedError(status).length).toBeGreaterThan(0)
    }
  })

  it('falls back for unknown codes', () => {
    expect(messageForFeedError('SOMETHING_ELSE')).toContain('失败')
  })
})
