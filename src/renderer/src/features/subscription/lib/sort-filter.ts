import type { Podcast } from '@shared/types'

export type SortKey = 'recent' | 'title' | 'unread'

export function filterPodcasts(podcasts: Podcast[], query: string): Podcast[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return podcasts
  return podcasts.filter((podcast) => podcast.title.toLowerCase().includes(keyword))
}

export function sortPodcasts(podcasts: Podcast[], sortKey: SortKey): Podcast[] {
  const copy = [...podcasts]
  switch (sortKey) {
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
    case 'unread':
      return copy.sort((a, b) => (b.unreadCount ?? 0) - (a.unreadCount ?? 0))
    case 'recent':
    default:
      return copy.sort(
        (a, b) => (b.lastFetchedAt ?? b.subscribedAt) - (a.lastFetchedAt ?? a.subscribedAt)
      )
  }
}

export function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '未知'
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} 分钟前更新`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前更新`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前更新`
  const weeks = Math.floor(days / 7)
  return `${weeks} 周前更新`
}
