import { describe, expect, it } from 'vitest'

import { AddSubscriptionInputSchema } from './ipc-contract'

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
