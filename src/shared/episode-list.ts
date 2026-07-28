import type { Episode } from './types'

export interface EpisodeListPage {
  items: Episode[]
  total: number
  unreadCount: number
  offset: number
  limit: number
  hasMore: boolean
}

export const EPISODE_PAGE_SIZE = 50
