import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Episode, Podcast } from '@shared/types'
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
    render(<PodcastDetailPage podcastId="pod-1" onBack={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: '复制链接' }))
    await waitFor(() => {
      expect(window.api.clipboard.writeText).toHaveBeenCalledWith('https://example.com/feed.xml')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('已复制')
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
})
