import i18n from '@/lib/i18n'
import type { Folder, Podcast } from '@shared/types'
import { create } from 'zustand'

import * as subscriptionApi from './api'
import { messageForFeedError } from './lib/error-messages'
import { filterPodcasts, sortPodcasts, type SortKey } from './lib/sort-filter'

interface SubscriptionState {
  podcasts: Podcast[]
  folders: Folder[]
  loading: boolean
  error: string | null
  query: string
  sortKey: SortKey
  refreshingAll: boolean
  lastRefreshAdded: number | null
  load: () => Promise<void>
  loadFolders: () => Promise<void>
  add: (feedUrl: string) => Promise<void>
  refresh: (podcastId: string) => Promise<void>
  refreshAll: () => Promise<void>
  setPaused: (podcastId: string, paused: boolean) => Promise<void>
  remove: (podcastId: string, deleteData?: boolean) => Promise<void>
  createFolder: (name: string) => Promise<Folder>
  renameFolder: (folderId: string, name: string) => Promise<void>
  deleteFolder: (folderId: string) => Promise<void>
  setPodcastFolder: (podcastId: string, folderId: string | null) => Promise<void>
  setQuery: (query: string) => void
  setSortKey: (sortKey: SortKey) => void
  dismissRefreshResult: () => void
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
  folders: [],
  loading: true,
  error: null,
  query: '',
  sortKey: 'recent',
  refreshingAll: false,
  lastRefreshAdded: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const [podcasts, folders] = await Promise.all([
        subscriptionApi.listSubscriptions(),
        subscriptionApi.listFolders()
      ])
      set({ podcasts, folders, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : i18n.t('subscription.loadFailed')
      })
    }
  },
  loadFolders: async () => {
    const folders = await subscriptionApi.listFolders()
    set({ folders })
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
  refreshAll: async () => {
    if (get().refreshingAll) return
    set({ refreshingAll: true, error: null, lastRefreshAdded: null })
    try {
      const results = await subscriptionApi.refreshAllSubscriptions()
      await get().load()
      const addedCount = results.reduce((sum, item) => sum + item.addedCount, 0)
      set({ refreshingAll: false, lastRefreshAdded: addedCount, error: null })
    } catch (error) {
      const mapped = mapRefreshError(error)
      set({ refreshingAll: false, error: mapped })
      throw new Error(mapped)
    }
  },
  setPaused: async (podcastId, paused) => {
    await subscriptionApi.setSubscriptionPaused(podcastId, paused)
    await get().load()
  },
  remove: async (podcastId, deleteData = false) => {
    await subscriptionApi.removeSubscription(podcastId, deleteData)
    await get().load()
  },
  createFolder: async (name) => {
    const folder = await subscriptionApi.createFolder(name)
    await get().load()
    return folder
  },
  renameFolder: async (folderId, name) => {
    await subscriptionApi.renameFolder(folderId, name)
    await get().load()
  },
  deleteFolder: async (folderId) => {
    await subscriptionApi.deleteFolder(folderId)
    await get().load()
  },
  setPodcastFolder: async (podcastId, folderId) => {
    await subscriptionApi.setPodcastFolder(podcastId, folderId)
    await get().load()
  },
  setQuery: (query) => set({ query }),
  setSortKey: (sortKey) => set({ sortKey }),
  dismissRefreshResult: () => set({ lastRefreshAdded: null }),
  visiblePodcasts: () => {
    const { podcasts, query, sortKey } = get()
    return sortPodcasts(filterPodcasts(podcasts, query), sortKey)
  }
}))
