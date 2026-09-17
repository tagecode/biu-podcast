import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Episode, Podcast } from '@shared/types'
import { CopiedToast } from '../components/CopiedToast'
import { PodcastDetailPage } from './PodcastDetailPage'
import { usePlaybackStore } from '@/features/playback/store'
import { useSubscriptionStore } from '@/features/subscription/store'

function makePodcast(overrides: Partial<Podcast> = {}): Podcast {
  return {
    id: 'pod-1',
    feedUrl: 'https://example.com/feed.xml',
    title: 'Test Podcast',
    description: null,
    coverUrl: null,
    author: null,
    language: null,
    isPaused: false,
    subscribedAt: 1,
    lastFetchedAt: null,
    lastFetchStatus: null,
    ...overrides
  }
}

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-1',
    podcastId: 'pod-1',
    title: 'AI 周报',
    descriptionHtml: null,
    publishedAt: 1700000000000,
    audioUrl: 'https://example.com/ep.mp3',
    durationSec: 600,
    fileSizeBytes: 1024,
    isPlayed: false,
    playbackPositionSec: 0,
    isDownloaded: false,
    localFilePath: null,
    downloadStatus: null,
    downloadedAt: null,
    guid: 'g1',
    ...overrides
  }
}

describe('PodcastDetailPage copy link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      episode: {
        listByPodcast: vi.fn(async () => ({
          ok: true as const,
          data: { items: [], total: 0, unreadCount: 0, offset: 0, limit: 50, hasMore: false }
        })),
        onChanged: vi.fn(() => () => {})
      },
      clipboard: { writeText: vi.fn(async () => ({ ok: true as const, data: undefined })) },
      contextMenu: { show: vi.fn(async () => ({ ok: true as const, data: null })) }
    } as unknown as Window['api']
    useSubscriptionStore.setState({
      podcasts: [makePodcast()],
      loading: false,
      refresh: vi.fn(),
      remove: vi.fn(),
      setPaused: vi.fn()
    } as never)
  })

  afterEach(() => {
    cleanup()
  })

  it('copies the podcast feed URL', async () => {
    render(
      <>
        <CopiedToast />
        <PodcastDetailPage podcastId="pod-1" onBack={() => {}} />
      </>
    )

    fireEvent.click(await screen.findByRole('button', { name: '复制链接' }))
    await waitFor(() => {
      expect(window.api.clipboard.writeText).toHaveBeenCalledWith('https://example.com/feed.xml')
    })
    expect(await screen.findAllByText('已复制')).toHaveLength(1)
    expect(screen.getByText('已复制').className).toMatch(/\babsolute\b/)
    expect(screen.getByText('已复制').className).not.toMatch(/\bfixed\b/)
  })

  it('shows a single copied toast from the episode context menu', async () => {
    const episode = makeEpisode()
    window.api.episode.listByPodcast = vi.fn(async () => ({
      ok: true as const,
      data: { items: [episode], total: 1, unreadCount: 1, offset: 0, limit: 50, hasMore: false }
    }))
    window.api.contextMenu.show = vi.fn(async () => ({ ok: true as const, data: 'copyLink' }))

    render(
      <>
        <CopiedToast />
        <PodcastDetailPage podcastId="pod-1" onBack={() => {}} />
      </>
    )

    fireEvent.contextMenu(await screen.findByText('AI 周报'))
    await waitFor(() => {
      expect(window.api.clipboard.writeText).toHaveBeenCalledWith('https://example.com/ep.mp3')
    })
    expect(screen.getAllByText('已复制')).toHaveLength(1)
    expect(screen.getByText('已复制').className).toMatch(/\bfixed\b/)
  })

  it('adds an episode to the queue from the native context menu', async () => {
    const episode = makeEpisode()
    window.api.episode.listByPodcast = vi.fn(async () => ({
      ok: true as const,
      data: { items: [episode], total: 1, unreadCount: 1, offset: 0, limit: 50, hasMore: false }
    }))
    window.api.contextMenu.show = vi.fn(async () => ({ ok: true as const, data: 'addToQueue' }))
    usePlaybackStore.setState({ queueItems: [] })

    render(<PodcastDetailPage podcastId="pod-1" onBack={() => {}} />)

    fireEvent.contextMenu(await screen.findByText('AI 周报'))

    await waitFor(() => {
      expect(usePlaybackStore.getState().queueItems.map((item) => item.id)).toEqual(['ep-1'])
    })
    expect(window.api.contextMenu.show).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          { id: 'play', label: '播放' },
          { id: 'download', label: '下载', enabled: true },
          { id: 'addToQueue', label: '加入播放队列' },
          { id: 'copyLink', label: '复制链接' },
          { id: 'openDetail', label: '打开详情' }
        ])
      })
    )
  })

  it('spins the refresh icon while the podcast feed is updating', async () => {
    let resolveRefresh: () => void = () => undefined
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve
        })
    )
    useSubscriptionStore.setState({ refresh } as never)

    render(<PodcastDetailPage podcastId="pod-1" onBack={() => {}} />)

    const button = await screen.findByRole('button', { name: '刷新' })
    fireEvent.click(button)

    expect(refresh).toHaveBeenCalledWith('pod-1')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(button.querySelector('svg')).toHaveClass('animate-spin')

    resolveRefresh()

    await waitFor(() => {
      expect(button).toBeEnabled()
    })
    expect(button).not.toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('svg')).not.toHaveClass('animate-spin')
  })

  it('stops spinning if refresh fails', async () => {
    let rejectRefresh: (error: Error) => void = () => undefined
    const refresh = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRefresh = reject
        })
    )
    useSubscriptionStore.setState({ refresh } as never)

    render(<PodcastDetailPage podcastId="pod-1" onBack={() => {}} />)

    const button = await screen.findByRole('button', { name: '刷新' })
    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('svg')).toHaveClass('animate-spin')

    rejectRefresh(new Error('network'))

    await waitFor(() => {
      expect(button).toBeEnabled()
    })
    expect(button.querySelector('svg')).not.toHaveClass('animate-spin')
    expect(button).not.toHaveAttribute('aria-busy', 'true')
  })
})
