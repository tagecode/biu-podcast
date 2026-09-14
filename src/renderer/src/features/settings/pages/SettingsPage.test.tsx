import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppSettings } from '@shared/types'
import { SettingsPage } from './SettingsPage'

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    downloadPath: null,
    resumeOnLaunch: true,
    lastEpisodeId: null,
    lastPodcastId: null,
    lastPositionSec: 0,
    autoRefreshMinutes: null,
    playbackRate: 1,
    openFullPlayerDefault: false,
    notificationsEnabled: true,
    closeToTray: true,
    theme: 'system',
    fontScale: 100,
    language: 'system',
    cleanupRetentionDays: null,
    loggingEnabled: true,
    freeSpaceThresholdMB: 500,
    shortcutBindings: {},
    autoLaunchEnabled: false,
    ...overrides
  }
}

describe('SettingsPage free-space threshold', () => {
  const settingsApi = {
    set: vi.fn(async () => ({ ok: true as const, data: undefined }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Radix Select uses pointer events + auto-scroll that jsdom lacks.
    Element.prototype.scrollIntoView = vi.fn()
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    window.api = {
      settings: {
        get: vi.fn(async () => ({ ok: true as const, data: makeSettings() })),
        set: settingsApi.set
      },
      download: { getDir: vi.fn(async () => ({ ok: true as const, data: '/tmp/dl' })) },
      storage: {
        usage: vi.fn(async () => ({
          ok: true as const,
          data: { podcasts: [], totalBytes: 0 }
        })),
        cleanupPreview: vi.fn(async () => ({
          ok: true as const,
          data: { items: [], totalBytes: 0 }
        }))
      },
      update: {
        getStatus: vi.fn(async () => ({ ok: true as const, data: { phase: 'idle' } })),
        onStatus: vi.fn(() => () => {})
      },
      subscription: { list: vi.fn(async () => ({ ok: true as const, data: [] })) },
      shortcuts: {
        getConfig: vi.fn(async () => ({
          ok: true as const,
          data: { custom: {}, defaults: {} }
        })),
        onApplied: vi.fn(() => () => {})
      }
    } as unknown as Window['api']
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the configured threshold and persists a change', async () => {
    render(<SettingsPage onBack={() => {}} onOpenAbout={() => {}} />)
    // The storage section header confirms the page rendered.
    await screen.findByText('存储设置')
    const trigger = screen.getByLabelText('下载前剩余空间预警')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('500 MB')

    // Change to 1 GB via the select.
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    const option = await screen.findByRole('option', { name: '1 GB' })
    fireEvent.click(option)

    await waitFor(() => {
      expect(settingsApi.set).toHaveBeenCalledWith({ key: 'freeSpaceThresholdMB', value: 1000 })
    })
  })

  it('saves and rolls back the auto-launch toggle on failure', async () => {
    const user = userEvent.setup()
    window.api.settings.get = vi.fn(async () => ({
      ok: true as const,
      data: makeSettings({ autoLaunchEnabled: false })
    }))
    window.api.settings.set = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'NOT_SUPPORTED', message: '当前系统不支持开机自启' }
    }))
    render(<SettingsPage onBack={() => {}} onOpenAbout={() => {}} />)

    const toggle = await screen.findByRole('checkbox', { name: '登录时自动启动' })
    await user.click(toggle)

    expect(window.api.settings.set).toHaveBeenCalledWith({ key: 'autoLaunchEnabled', value: true })
    expect(await screen.findByText('当前系统不支持开机自启')).toBeInTheDocument()
    expect(toggle).not.toBeChecked()
  })
})
