import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionStore } from './store'
import type { Podcast } from '@shared/types'

const list = vi.fn()
const listFolders = vi.fn()
const refreshAll = vi.fn()

function makePodcast(id: string): Podcast {
  return {
    id,
    feedUrl: `https://example.com/${id}.xml`,
    title: id,
    description: null,
    coverUrl: null,
    author: null,
    language: null,
    isPaused: false,
    subscribedAt: 1,
    lastFetchedAt: 1,
    lastFetchStatus: 'ok',
    unreadCount: 0
  }
}

describe('useSubscriptionStore.refreshAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({ ok: true as const, data: [makePodcast('pod-1')] })
    listFolders.mockResolvedValue({ ok: true as const, data: [] })
    refreshAll.mockResolvedValue({
      ok: true as const,
      data: [
        { podcastId: 'pod-1', addedCount: 2 },
        { podcastId: 'pod-2', addedCount: 0 }
      ]
    })
    window.api = {
      subscription: { list, listFolders, refreshAll }
    } as unknown as Window['api']
    useSubscriptionStore.setState({
      podcasts: [],
      folders: [],
      loading: false,
      error: null,
      query: '',
      sortKey: 'recent',
      refreshingAll: false,
      lastRefreshAdded: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pulls every active feed then reloads the list and records added count', async () => {
    await useSubscriptionStore.getState().refreshAll()

    expect(refreshAll).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledTimes(1)
    expect(useSubscriptionStore.getState().podcasts).toHaveLength(1)
    expect(useSubscriptionStore.getState().lastRefreshAdded).toBe(2)
    expect(useSubscriptionStore.getState().refreshingAll).toBe(false)
  })

  it('maps a network failure to a user-facing error', async () => {
    refreshAll.mockResolvedValueOnce({
      ok: false as const,
      error: { code: 'NETWORK_ERROR', message: 'offline' }
    })

    await expect(useSubscriptionStore.getState().refreshAll()).rejects.toThrow()
    expect(useSubscriptionStore.getState().error).toBeTruthy()
    expect(useSubscriptionStore.getState().refreshingAll).toBe(false)
  })
})
