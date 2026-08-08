import i18n from '@/lib/i18n'
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
  if (!timestamp) return i18n.t('subscription.timeUnknown')
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return i18n.t('subscription.timeMinutesAgo', { count: Math.max(minutes, 1) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return i18n.t('subscription.timeHoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return i18n.t('subscription.timeDaysAgo', { count: days })
  const weeks = Math.floor(days / 7)
  return i18n.t('subscription.timeWeeksAgo', { count: weeks })
}
