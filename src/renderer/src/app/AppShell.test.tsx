import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'
import { useSubscriptionStore } from '@/features/subscription/store'

function stubApi(): Window['api'] {
  return {
    files: { getPathForFile: vi.fn(() => '/tmp/feeds.opml') },
    subscription: {
      list: vi.fn(async () => ({ ok: true as const, data: [] })),
      importOpmlPath: vi.fn(async () => ({
        ok: true as const,
        data: { filePath: '/tmp/feeds.opml', added: 2, skipped: 1, failed: [] }
      })),
      onChanged: vi.fn(() => () => {}),
      onDeepLinkSubscribe: vi.fn(() => () => {})
    },
    episode: { search: vi.fn(async () => ({ ok: true as const, data: [] })) },
    download: {
      list: vi.fn(async () => ({ ok: true as const, data: [] })),
      onProgress: vi.fn(() => () => {})
    },
    playback: {
      getLastSession: vi.fn(async () => ({ ok: true as const, data: null })),
      getRegisteredShortcuts: vi.fn(async () => ({ ok: true as const, data: {} })),
      onCommand: vi.fn(() => () => {}),
      onDeepLinkPlay: vi.fn(() => () => {})
    },
    queue: { load: vi.fn(async () => ({ ok: true as const, data: null })) },
    settings: {
      get: vi.fn(async () => ({
        ok: true as const,
        data: { playbackRate: 1, openFullPlayerDefault: false }
      }))
    },
    window: {
      isMaximized: vi.fn(async () => ({ ok: true as const, data: false }))
    }
  } as unknown as Window['api']
}

describe('AppShell OPML drag import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = stubApi()
  })

  afterEach(() => {
    cleanup()
  })

  it('imports a dropped OPML file and reloads subscriptions', async () => {
    const load = vi.fn()
    useSubscriptionStore.setState({ podcasts: [], loading: false, load } as never)

    render(<AppShell />)
    const file = new File(['<opml />'], 'feeds.opml', { type: 'text/xml' })
    fireEvent.drop(screen.getByTestId('app-shell'), { dataTransfer: { files: [file] } })

    await waitFor(() =>
      expect(window.api.subscription.importOpmlPath).toHaveBeenCalledWith({
        filePath: '/tmp/feeds.opml'
      })
    )
    expect(load).toHaveBeenCalled()
  })
})
