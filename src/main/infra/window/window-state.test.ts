import { describe, expect, it } from 'vitest'

import { resolveWindowBounds, type DisplayBounds, type SavedWindowState } from './window-state'

describe('resolveWindowBounds', () => {
  const displays: DisplayBounds[] = [
    { x: 0, y: 0, width: 1920, height: 1080 },
    { x: 1920, y: 0, width: 1920, height: 1080 }
  ]

  it('keeps saved bounds when visible on a display', () => {
    const saved: SavedWindowState = {
      x: 100,
      y: 80,
      width: 1280,
      height: 800,
      isMaximized: false
    }
    expect(resolveWindowBounds(saved, displays, { width: 1280, height: 800 })).toEqual(saved)
  })

  it('falls back to primary center when saved bounds are off-screen', () => {
    const saved: SavedWindowState = {
      x: 8000,
      y: 8000,
      width: 1280,
      height: 800,
      isMaximized: false
    }
    const resolved = resolveWindowBounds(saved, displays, { width: 1280, height: 800 })
    expect(resolved).toEqual({
      x: Math.round((1920 - 1280) / 2),
      y: Math.round((1080 - 800) / 2),
      width: 1280,
      height: 800,
      isMaximized: false
    })
  })

  it('uses defaults when no saved state', () => {
    const resolved = resolveWindowBounds(null, displays, { width: 1280, height: 800 })
    expect(resolved.width).toBe(1280)
    expect(resolved.height).toBe(800)
    expect(resolved.isMaximized).toBe(false)
  })
})
