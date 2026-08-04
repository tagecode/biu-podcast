import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WindowControls } from './WindowControls'

describe('WindowControls', () => {
  const windowApi = {
    minimize: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
    maximize: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
    close: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
    isMaximized: vi.fn(() => Promise.resolve({ ok: true as const, data: false }))
  }

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    window.api = { window: windowApi } as unknown as Window['api']
  })

  it('renders the three window controls', () => {
    render(<WindowControls />)
    expect(screen.getByRole('button', { name: '最小化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最大化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
  })

  it('minimize calls window.api.window.minimize', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByRole('button', { name: '最小化' }))
    expect(windowApi.minimize).toHaveBeenCalledTimes(1)
  })

  it('close calls window.api.window.close', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(windowApi.close).toHaveBeenCalledTimes(1)
  })

  it('maximize toggles and refreshes the isMaximized state', async () => {
    windowApi.isMaximized.mockResolvedValueOnce({ ok: true as const, data: false })
    windowApi.maximize.mockResolvedValueOnce({ ok: true as const, data: undefined })
    windowApi.isMaximized.mockResolvedValueOnce({ ok: true as const, data: true })

    render(<WindowControls />)
    // initial state query
    expect(windowApi.isMaximized).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '最大化' }))
    expect(windowApi.maximize).toHaveBeenCalledTimes(1)

    // state refreshed after maximize resolves to true → label becomes 还原
    await screen.findByRole('button', { name: '还原' })
  })
})
