import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EpisodeSearchHit } from '@shared/types'
import { SubscriptionListView } from './SubscriptionListView'
import { useSubscriptionStore } from '../store'

function makeHit(title: string): EpisodeSearchHit {
  return {
    podcastTitle: '科技早知道',
    episode: {
      id: 'ep-1',
      podcastId: 'pod-1',
      title,
      descriptionHtml: null,
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep.mp3',
      durationSec: 600,
      fileSizeBytes: 1024,
      isPlayed: false,
      playbackPositionSec: 0,
      isDownloaded: true,
      localFilePath: '/tmp/ep.mp3',
      downloadStatus: 'completed',
      downloadedAt: 1700000000000,
      guid: 'g1'
    }
  }
}

describe('SubscriptionListView', () => {
  const refreshAll = vi.fn()
  const list = vi.fn()
  const search = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({ ok: true as const, data: [] })
    refreshAll.mockResolvedValue({ ok: true as const, data: [] })
    search.mockResolvedValue({ ok: true as const, data: [] })
    window.api = {
      subscription: {
        list,
        refreshAll,
        onChanged: vi.fn(() => () => undefined)
      },
      episode: { search }
    } as unknown as Window['api']
    useSubscriptionStore.setState({
      podcasts: [],
      loading: false,
      error: null,
      query: '',
      sortKey: 'recent',
      refreshingAll: false,
      lastRefreshAdded: null
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('refreshes every feed instead of only reloading the local list', async () => {
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: '刷新全部' }))

    await waitFor(() => {
      expect(refreshAll).toHaveBeenCalledTimes(1)
    })
  })

  it('lets the user dismiss the refresh result banner', () => {
    useSubscriptionStore.setState({ lastRefreshAdded: 3 })
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    expect(screen.getByText('发现 3 集新内容')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByText('发现 3 集新内容')).not.toBeInTheDocument()
  })

  it('searches local episodes when the query changes', async () => {
    search.mockResolvedValueOnce({ ok: true as const, data: [makeHit('AI 周报')] })
    render(<SubscriptionListView onOpenPodcast={() => undefined} onOpenEpisode={() => undefined} />)

    fireEvent.change(screen.getByPlaceholderText('搜索播客或集数…'), {
      target: { value: 'AI' }
    })

    expect(await screen.findByText('AI 周报')).toBeInTheDocument()
    expect(search).toHaveBeenCalledWith({ query: 'AI', downloadedOnly: false })
  })
})
