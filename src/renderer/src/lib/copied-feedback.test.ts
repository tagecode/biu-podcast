import { describe, expect, it, vi } from 'vitest'

import { notifyCopied, subscribeCopied } from './copied-feedback'

describe('copied-feedback', () => {
  it('notifies subscribers', () => {
    const spy = vi.fn()
    const stop = subscribeCopied(spy)
    notifyCopied()
    expect(spy).toHaveBeenCalledTimes(1)
    stop()
    notifyCopied()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
