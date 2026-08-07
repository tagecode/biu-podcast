import { describe, expect, it } from 'vitest'

import { createQueue, nextIndex, previousIndex, shuffle, type QueueState } from './queue'

describe('queue navigation', () => {
  const items = ['A', 'B', 'C']

  it('list mode moves forward and stops at the end', () => {
    const q: QueueState<string> = createQueue(items, 'list')
    expect(nextIndex(q)).toBe(1)
    expect(nextIndex({ ...q, currentIndex: 2 })).toBeNull()
  })

  it('list mode previous stops at the start', () => {
    const q: QueueState<string> = createQueue(items, 'list')
    expect(previousIndex({ ...q, currentIndex: 1 })).toBe(0)
    expect(previousIndex(q)).toBeNull()
  })

  it('repeat-one always returns the same index', () => {
    const q: QueueState<string> = createQueue(items, 'repeat-one')
    expect(nextIndex(q)).toBe(0)
    expect(previousIndex(q)).toBe(0)
  })

  it('shuffle mode wraps around via the shuffle order', () => {
    const q: QueueState<string> = {
      items,
      currentIndex: 1,
      mode: 'shuffle',
      shuffleOrder: [2, 0, 1]
    }
    // current index 1 is at shuffle position 2 → next wraps to position 0 = item 2.
    expect(nextIndex(q)).toBe(2)
    expect(previousIndex(q)).toBe(0)
  })

  it('handles empty queue', () => {
    const q = createQueue<string>([], 'list')
    expect(nextIndex(q)).toBeNull()
    expect(previousIndex(q)).toBeNull()
  })
})

describe('shuffle', () => {
  it('returns a permutation of the same items', () => {
    const items = [1, 2, 3, 4, 5]
    const result = shuffle(items, 42)
    expect([...result].sort()).toEqual([...items].sort())
  })

  it('is deterministic for a given seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], 7)).toEqual(shuffle([1, 2, 3, 4, 5], 7))
  })
})
