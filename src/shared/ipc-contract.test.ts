import { describe, expect, it } from 'vitest'

import { AddSubscriptionInputSchema, SearchEpisodesInputSchema } from './ipc-contract'

describe('AddSubscriptionInputSchema', () => {
  it('accepts valid urls', () => {
    const result = AddSubscriptionInputSchema.safeParse({
      feedUrl: 'https://example.com/feed.xml'
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid urls', () => {
    const result = AddSubscriptionInputSchema.safeParse({
      feedUrl: 'not-a-url'
    })
    expect(result.success).toBe(false)
  })
})

describe('SearchEpisodesInputSchema', () => {
  it('trims the query and defaults downloadedOnly to false', () => {
    const result = SearchEpisodesInputSchema.safeParse({ query: '  AI  ' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.query).toBe('AI')
    expect(result.data.downloadedOnly).toBe(false)
    expect(result.data.limit).toBe(50)
  })

  it('rejects a blank query', () => {
    const result = SearchEpisodesInputSchema.safeParse({ query: '   ' })
    expect(result.success).toBe(false)
  })
})
