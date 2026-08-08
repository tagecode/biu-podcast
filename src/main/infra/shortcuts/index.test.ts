import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hoisted mutable state so the (hoisted) mocks can share it with assertions.
const state = vi.hoisted(() => {
  const taken = new Set<string>()
  const registered = new Map<string, () => void>()
  const data = new Map<string, unknown>()
  data.set('shortcutBindings', {})
  return {
    taken,
    registered,
    settingsStore: {
      get: (key: string): unknown => data.get(key),
      set: (key: string, value: unknown): void => {
        data.set(key, value)
      },
      getAll: (): Record<string, unknown> => Object.fromEntries(data)
    }
  }
})

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn((accelerator: string, callback: () => void): boolean => {
      if (state.taken.has(accelerator)) return false
      state.registered.set(accelerator, callback)
      return true
    }),
    unregisterAll: vi.fn(() => state.registered.clear())
  }
}))

vi.mock('../settings/store', () => ({
  settingsStore: state.settingsStore
}))

import { AppError } from '@shared/errors'
import {
  applyShortcutBinding,
  getRegisteredShortcuts,
  getShortcutConfig,
  registerPlaybackShortcuts,
  unregisterPlaybackShortcuts
} from './index'

describe('global shortcuts (P1-15b)', () => {
  beforeEach(() => {
    state.taken.clear()
    state.registered.clear()
    state.settingsStore.set('shortcutBindings', {})
  })

  it('registers the default accelerators on startup', () => {
    registerPlaybackShortcuts(() => null)
    expect(getRegisteredShortcuts()).toEqual({
      toggle: 'CommandOrControl+Alt+P',
      next: 'CommandOrControl+Alt+N',
      previous: 'CommandOrControl+Alt+B'
    })
  })

  it('exposes defaults and no custom bindings in getShortcutConfig', () => {
    registerPlaybackShortcuts(() => null)
    expect(getShortcutConfig()).toEqual({
      custom: {},
      defaults: {
        toggle: 'CommandOrControl+Alt+P',
        next: 'CommandOrControl+Alt+N',
        previous: 'CommandOrControl+Alt+B'
      }
    })
  })

  it('applies a persisted custom binding on startup', () => {
    state.settingsStore.set('shortcutBindings', { toggle: 'CommandOrControl+Alt+T' })
    registerPlaybackShortcuts(() => null)
    expect(getRegisteredShortcuts().toggle).toBe('CommandOrControl+Alt+T')
    expect(getRegisteredShortcuts().next).toBe('CommandOrControl+Alt+N')
  })

  it('applyShortcutBinding saves and re-registers a new combo', () => {
    registerPlaybackShortcuts(() => null)
    const result = applyShortcutBinding('toggle', 'CommandOrControl+Shift+Space')
    expect(result).toEqual({ registered: 'CommandOrControl+Shift+Space' })
    expect(state.settingsStore.get('shortcutBindings')).toEqual({
      toggle: 'CommandOrControl+Shift+Space'
    })
    expect(getRegisteredShortcuts().toggle).toBe('CommandOrControl+Shift+Space')
  })

  it('rejects a combo already bound to another command', () => {
    registerPlaybackShortcuts(() => null)
    expect(() => applyShortcutBinding('toggle', 'CommandOrControl+Alt+N')).toThrowError(AppError)
    // Config unchanged.
    expect(state.settingsStore.get('shortcutBindings')).toEqual({})
  })

  it('detects duplicates against a custom binding of another command', () => {
    state.settingsStore.set('shortcutBindings', { next: 'CommandOrControl+Alt+X' })
    registerPlaybackShortcuts(() => null)
    expect(() => applyShortcutBinding('toggle', 'CommandOrControl+Alt+X')).toThrowError(AppError)
  })

  it('falls back and reverts when the user combo is owned by another app', () => {
    registerPlaybackShortcuts(() => null)
    state.taken.add('CommandOrControl+Alt+T')
    const result = applyShortcutBinding('toggle', 'CommandOrControl+Alt+T')
    // Reported as taken; registered falls back to the default.
    expect(result.taken).toBe(true)
    expect(result.registered).toBe('CommandOrControl+Alt+P')
    // Config reverted (no custom binding persisted).
    expect(state.settingsStore.get('shortcutBindings')).toEqual({})
    expect(getRegisteredShortcuts().toggle).toBe('CommandOrControl+Alt+P')
  })

  it('unbinds back to the default when accelerator is null', () => {
    state.settingsStore.set('shortcutBindings', { toggle: 'CommandOrControl+Alt+T' })
    registerPlaybackShortcuts(() => null)
    expect(getRegisteredShortcuts().toggle).toBe('CommandOrControl+Alt+T')

    const result = applyShortcutBinding('toggle', null)
    expect(result.registered).toBe('CommandOrControl+Alt+P')
    expect(state.settingsStore.get('shortcutBindings')).toEqual({})
    expect(getRegisteredShortcuts().toggle).toBe('CommandOrControl+Alt+P')
  })

  it('unregisterPlaybackShortcuts clears registered state', () => {
    registerPlaybackShortcuts(() => null)
    unregisterPlaybackShortcuts()
    expect(getRegisteredShortcuts()).toEqual({})
  })
})
