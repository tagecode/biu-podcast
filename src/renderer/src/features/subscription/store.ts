import type { Podcast } from '@shared/types'
import { create } from 'zustand'

import * as subscriptionApi from './api'
import { messageForFeedError } from './lib/error-messages'
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
  remove: (podcastId: string, deleteData?: boolean) => Promise<void>
  setQuery: (query: string) => void
  setSortKey: (sortKey: SortKey) => void
  visiblePodcasts: () => Podcast[]
}

function mapRefreshError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return messageForFeedError(String((error as { code: string }).code))
  }
  if (error instanceof Error) {
    if (/404|失效/.test(error.message)) return messageForFeedError('NOT_FOUND')
    if (/超时/.test(error.message)) return messageForFeedError('TIMEOUT')
    if (/解析|XML/.test(error.message)) return messageForFeedError('PARSE_ERROR')
    if (/网络|无网络/.test(error.message)) return messageForFeedError('NETWORK_ERROR')
    return error.message
  }
  return messageForFeedError('NETWORK_ERROR')
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
    try {
      await subscriptionApi.refreshSubscription(podcastId)
      await get().load()
      set({ error: null })
    } catch (error) {
      const mapped = mapRefreshError(error)
      set({ error: mapped })
      throw new Error(mapped)
    }
  },
  remove: async (podcastId, deleteData = false) => {
    await subscriptionApi.removeSubscription(podcastId, deleteData)
    await get().load()
  },
  setQuery: (query) => set({ query }),
  setSortKey: (sortKey) => set({ sortKey }),
  visiblePodcasts: () => {
    const { podcasts, query, sortKey } = get()
    return sortPodcasts(filterPodcasts(podcasts, query), sortKey)
  }
}))
