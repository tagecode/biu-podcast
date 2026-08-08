import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ShortcutConfig } from '@shared/ipc-contract'
import { eventToAccelerator } from '../lib/shortcut-record'
import { ShortcutSettings } from './ShortcutSettings'

describe('eventToAccelerator', () => {
  const key = (init: KeyboardEventInit): KeyboardEvent =>
    new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', ...init })

  it('builds Ctrl+Shift combos', () => {
    expect(eventToAccelerator(key({ ctrlKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+P'
    )
  })

  it('maps Alt and Space', () => {
    expect(eventToAccelerator(key({ altKey: true }))).toBe('Alt+P')
    expect(
      eventToAccelerator(new KeyboardEvent('keydown', { code: 'Space', key: ' ', ctrlKey: true }))
    ).toBe('CommandOrControl+Space')
  })

  it('accepts function keys without modifiers', () => {
    expect(eventToAccelerator(new KeyboardEvent('keydown', { code: 'F9', key: 'F9' }))).toBe('F9')
  })

  it('rejects bare letters and arrow keys without modifiers', () => {
    expect(eventToAccelerator(key({}))).toBeNull()
    expect(
      eventToAccelerator(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' }))
    ).toBeNull()
  })

  it('rejects pure modifier presses', () => {
    expect(
      eventToAccelerator(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }))
    ).toBeNull()
  })
})

describe('ShortcutSettings', () => {
  const config: ShortcutConfig = {
    custom: {},
    defaults: {
      toggle: 'CommandOrControl+Alt+P',
      next: 'CommandOrControl+Alt+N',
      previous: 'CommandOrControl+Alt+B'
    }
  }

  const api = {
    getConfig: vi.fn(async () => ({ ok: true as const, data: config })),
    set: vi.fn(async () => ({ ok: true as const, data: { registered: 'CommandOrControl+Alt+P' } })),
    onApplied: vi.fn(() => () => {})
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      shortcuts: api
    } as unknown as Window['api']
  })

  afterEach(() => {
    cleanup()
  })

  it('lists the three commands with their default bindings', async () => {
    render(<ShortcutSettings />)
    expect(await screen.findByText('播放/暂停')).toBeInTheDocument()
    expect(screen.getByText('下一集')).toBeInTheDocument()
    expect(screen.getByText('上一集')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('Ctrl + Alt + P').length).toBeGreaterThan(0)
    })
  })

  it('shows the reset-to-default button only for custom bindings', async () => {
    const customConfig: ShortcutConfig = {
      custom: { toggle: 'CommandOrControl+Alt+T' },
      defaults: config.defaults
    }
    api.getConfig.mockResolvedValueOnce({ ok: true as const, data: customConfig })
    render(<ShortcutSettings />)
    await waitFor(() => {
      expect(screen.getAllByText('恢复默认').length).toBe(1)
    })
    expect(screen.getAllByText('Ctrl + Alt + T').length).toBeGreaterThan(0)
  })

  it('records a new combo via keydown and persists it', async () => {
    render(<ShortcutSettings />)
    await screen.findByText('播放/暂停')

    // Click the toggle row's record button (first one in the list).
    const recordButton = screen.getAllByRole('button', { name: '录制快捷键' })[0]
    fireEvent.click(recordButton)

    fireEvent.keyDown(window, { key: 't', code: 'KeyT', ctrlKey: true, altKey: true })

    await waitFor(() => {
      expect(api.set).toHaveBeenCalledWith({
        command: 'toggle',
        accelerator: 'CommandOrControl+Alt+T'
      })
    })
  })

  it('cancels recording on Escape without saving', async () => {
    render(<ShortcutSettings />)
    await screen.findByText('播放/暂停')

    fireEvent.click(screen.getAllByRole('button', { name: '录制快捷键' })[0])
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })

    expect(api.set).not.toHaveBeenCalled()
  })
})
