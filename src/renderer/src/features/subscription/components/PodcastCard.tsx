import type { Podcast } from '@shared/types'

import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '../lib/sort-filter'

interface PodcastCardProps {
  podcast: Podcast
  onClick: () => void
}

function CoverPlaceholder({ title }: { title: string }): React.JSX.Element {
  const initial = title.trim().charAt(0) || '播'
  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-line text-3xl font-semibold text-muted">
      {initial}
    </div>
  )
}

export function PodcastCard({ podcast, onClick }: PodcastCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded-lg border border-line bg-surface text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-line">
        {podcast.coverUrl ? (
          <img src={podcast.coverUrl} alt={podcast.title} className="size-full object-cover" />
        ) : (
          <CoverPlaceholder title={podcast.title} />
        )}
        {podcast.isPaused ? (
          <Badge className="absolute top-2 left-2 rounded-full bg-muted px-2 py-0.5 text-xs text-white">
            已暂停
          </Badge>
        ) : null}
        {(podcast.unreadCount ?? 0) > 0 ? (
          <Badge className="absolute top-2 right-2 min-w-[22px] justify-center rounded-full bg-amber-600 px-1.5 text-ink">
            {podcast.unreadCount}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{podcast.title}</h3>
        <p className="text-xs text-muted">{formatRelativeTime(podcast.lastFetchedAt)}</p>
        <p className="text-xs text-muted">
          <span className="text-amber-700">{podcast.unreadCount ?? 0} 集未听</span>
          <span className="mx-1 text-line">·</span>
          <span>{podcast.playedCount ?? 0} 集已听</span>
        </p>
      </div>
    </button>
  )
}
