import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyAppearance, applyFontScale, applyTheme } from './appearance'

/**
 * matchMedia is not implemented in jsdom — mock the minimal surface used by
 * applyTheme for 'system' mode (addEventListener / removeEventListener).
 */
function mockMatchMedia(initialMatches = false): void {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql = {
    get matches() {
      return initialMatches
    },
    addEventListener: vi.fn((_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeEventListener: vi.fn((_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    })
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql)
  )
  // Let tests trigger the OS-theme-change callback.
  ;(mql as unknown as { fire: (dark: boolean) => void }).fire = (dark: boolean): void => {
    listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.className = ''
  document.documentElement.style.fontSize = ''
})

describe('applyTheme', () => {
  it('adds .dark for dark mode', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes .dark for light mode', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('follows the system and reacts to changes in system mode', () => {
    mockMatchMedia(false)
    applyTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    const mql = window.matchMedia('(prefers-color-scheme: dark)') as unknown as {
      fire: (dark: boolean) => void
    }
    mql.fire(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    mql.fire(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('switching away from system unsubscribes the OS listener', () => {
    mockMatchMedia(false)
    applyTheme('system')
    const removeListener = vi.mocked(window.matchMedia('x').removeEventListener)
    applyTheme('light')
    expect(removeListener).toHaveBeenCalled()
  })
})

describe('applyFontScale', () => {
  it('sets font-size for a non-default scale', () => {
    applyFontScale(120)
    expect(document.documentElement.style.fontSize).toBe('120%')
  })

  it('clears font-size for the default scale', () => {
    applyFontScale(120)
    applyFontScale(100)
    expect(document.documentElement.style.fontSize).toBe('')
  })
})

describe('applyAppearance', () => {
  it('applies both theme and font scale', () => {
    applyAppearance({ theme: 'dark', fontScale: 110 })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.fontSize).toBe('110%')
  })
})
