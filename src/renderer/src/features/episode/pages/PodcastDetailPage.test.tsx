import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Podcast } from '@shared/types'
import { PodcastDetailPage } from './PodcastDetailPage'
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
      clipboard: { writeText: vi.fn(async () => ({ ok: true as const, data: undefined })) }
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
  })
})
