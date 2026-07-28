import type { Podcast } from '@shared/types'
import { create } from 'zustand'

import * as subscriptionApi from './api'
import { filterPodcasts, sortPodcasts, type SortKey } from './lib/sort-filter'

interface SubscriptionState {
  podcasts: Podcast[]
  loading: boolean
  error: string | null
  query: string
  sortKey: SortKey
  load: () => Promise<void>
  add: (feedUrl: string) => Promise<void>
  refresh: (podcastId: string) => Promise<void>
  remove: (podcastId: string) => Promise<void>
  setQuery: (query: string) => void
  setSortKey: (sortKey: SortKey) => void
  visiblePodcasts: () => Podcast[]
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  podcasts: [],
  loading: true,
  error: null,
  query: '',
  sortKey: 'recent',
  load: async () => {
    set({ loading: true, error: null })
    try {
      const podcasts = await subscriptionApi.listSubscriptions()
      set({ podcasts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '加载订阅列表失败'
      })
    }
  },
  add: async (feedUrl) => {
    await subscriptionApi.addSubscription(feedUrl)
    await get().load()
  },
  refresh: async (podcastId) => {
    await subscriptionApi.refreshSubscription(podcastId)
    await get().load()
  },
  remove: async (podcastId) => {
    await subscriptionApi.removeSubscription(podcastId)
    await get().load()
  },
  setQuery: (query) => set({ query }),
  setSortKey: (sortKey) => set({ sortKey }),
  visiblePodcasts: () => {
    const { podcasts, query, sortKey } = get()
    return sortPodcasts(filterPodcasts(podcasts, query), sortKey)
  }
}))
