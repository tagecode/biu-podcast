export type QueueMode = 'list' | 'repeat-one' | 'shuffle'

export interface QueueState<T> {
  items: T[]
  currentIndex: number
  mode: QueueMode
  /** Shuffle order (indices into items), when mode === 'shuffle'. */
  shuffleOrder: number[]
}

export function createQueue<T>(items: T[], mode: QueueMode = 'list'): QueueState<T> {
  return { items, currentIndex: 0, mode, shuffleOrder: [] }
}

/** Deterministic shuffle (Fisher-Yates with a seeded PRNG). */
export function shuffle<T>(items: T[], seed = 0): T[] {
  const result = [...items]
  let s = seed
  const rand = (): number => {
    // xorshift32
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/**
 * Move to the next position according to the queue mode.
 * Returns the new index, or null when there is no next item (e.g. list mode at
 * the end).
 */
export function nextIndex<T>(state: QueueState<T>): number | null {
  if (state.items.length === 0) return null
  switch (state.mode) {
    case 'repeat-one':
      return state.currentIndex
    case 'shuffle': {
      const pos = state.shuffleOrder.indexOf(state.currentIndex)
      const nextPos = (pos + 1) % state.shuffleOrder.length
      return state.shuffleOrder[nextPos] ?? null
    }
    case 'list':
    default: {
      const next = state.currentIndex + 1
      return next < state.items.length ? next : null
    }
  }
}

/** Move to the previous position (list: wraps; shuffle: wraps; repeat-one: same). */
export function previousIndex<T>(state: QueueState<T>): number | null {
  if (state.items.length === 0) return null
  switch (state.mode) {
    case 'repeat-one':
      return state.currentIndex
    case 'shuffle': {
      const pos = state.shuffleOrder.indexOf(state.currentIndex)
      const prevPos = (pos - 1 + state.shuffleOrder.length) % state.shuffleOrder.length
      return state.shuffleOrder[prevPos] ?? null
    }
    case 'list':
    default: {
      const prev = state.currentIndex - 1
      return prev >= 0 ? prev : null
    }
  }
}
