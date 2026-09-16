import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'
import { useSubscriptionStore } from '@/features/subscription/store'

function stubApi(): Window['api'] {
  return {
    files: { getPathForFile: vi.fn(() => '/tmp/feeds.opml') },
    subscription: {
      list: vi.fn(async () => ({ ok: true as const, data: [] })),
      previewOpmlPath: vi.fn(async () => ({
        ok: true as const,
        data: {
          filePath: '/tmp/feeds.opml',
          items: [{ title: 'A', feedUrl: 'https://example.com/a.xml', folderName: null }]
        }
      })),
      importOpmlItems: vi.fn(async () => ({
        ok: true as const,
        data: { filePath: '', added: 2, skipped: 1, failed: [] }
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
    },
    contextMenu: {
      show: vi.fn(async () => ({ ok: true as const, data: null }))
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

  it('opens a preview instead of importing a dropped OPML file', async () => {
    const load = vi.fn()
    useSubscriptionStore.setState({ podcasts: [], loading: false, load } as never)

    render(<AppShell />)
    const file = new File(['<opml />'], 'feeds.opml', { type: 'text/xml' })
    fireEvent.drop(screen.getByTestId('app-shell'), { dataTransfer: { files: [file] } })

    await waitFor(() =>
      expect(window.api.subscription.previewOpmlPath).toHaveBeenCalledWith({
        filePath: '/tmp/feeds.opml'
      })
    )
    expect(window.api.subscription.importOpmlItems).not.toHaveBeenCalled()
    expect(await screen.findByText('导入预览')).toBeInTheDocument()
  })

  it('imports after confirming the OPML preview', async () => {
    const load = vi.fn()
    useSubscriptionStore.setState({ podcasts: [], loading: false, load } as never)

    render(<AppShell />)
    await waitFor(() => expect(load).toHaveBeenCalled())
    load.mockClear()

    const file = new File(['<opml />'], 'feeds.opml', { type: 'text/xml' })
    fireEvent.drop(screen.getByTestId('app-shell'), { dataTransfer: { files: [file] } })

    expect(await screen.findByText('导入预览')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '导入选中项' }))

    await waitFor(() => expect(window.api.subscription.importOpmlItems).toHaveBeenCalled())
    expect(load).toHaveBeenCalled()
  })

  it('rejects a dropped non-OPML file without importing', async () => {
    render(<AppShell />)
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' })
    fireEvent.drop(screen.getByTestId('app-shell'), { dataTransfer: { files: [file] } })

    expect(await screen.findByText('请拖入 .opml 或 .xml 订阅文件')).toBeInTheDocument()
    expect(window.api.subscription.previewOpmlPath).not.toHaveBeenCalled()
    expect(window.api.subscription.importOpmlItems).not.toHaveBeenCalled()
  })
})

describe('AppShell editable context menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = stubApi()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows cut/copy/paste/selectAll for an input portaled outside the shell', () => {
    render(<AppShell />)

    const input = document.createElement('input')
    document.body.appendChild(input)

    expect(screen.getByTestId('app-shell').contains(input)).toBe(false)

    try {
      fireEvent.contextMenu(input)

      expect(window.api.contextMenu.show).toHaveBeenCalled()
      const payload = vi.mocked(window.api.contextMenu.show).mock.calls[0][0]
      expect(payload.items.map((item) => item.id)).toEqual(['cut', 'copy', 'paste', 'selectAll'])
    } finally {
      input.remove()
    }
  })
})
