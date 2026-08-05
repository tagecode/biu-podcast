import { AlertCircle, CheckCircle2, Download, Pause, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Episode } from '@shared/types'
import { cn } from '@/lib/utils'

import { formatDate, formatDuration, formatFileSize } from '@/lib/format'

interface EpisodeListItemProps {
  episode: Episode
  active?: boolean
  selected?: boolean
  /** This episode is the current track AND audio is playing — show a pause button. */
  isCurrentPlaying?: boolean
  onPlay: () => void
  onDownload?: () => void
  onOpenDetail?: () => void
}

export function EpisodeListItem({
  episode,
  active,
  selected,
  isCurrentPlaying,
  onPlay,
  onDownload,
  onOpenDetail
}: EpisodeListItemProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border px-4 py-3 transition-colors',
        active || selected
          ? 'border-amber-600 bg-amber-100'
          : 'border-transparent bg-surface hover:border-line hover:shadow-sm'
      )}
    >
      {!episode.isPlayed ? (
        <span className="size-2 shrink-0 rounded-full bg-amber-600" />
      ) : (
        <span className="size-2 shrink-0" />
      )}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onOpenDetail}
        disabled={!onOpenDetail}
      >
        <div
          className={cn(
            'truncate text-sm font-medium',
            episode.isPlayed ? 'text-muted' : 'text-ink'
          )}
        >
          {episode.title}
        </div>
        <div className="mt-0.5 font-mono text-xs text-muted">
          {formatDate(episode.publishedAt)} · {formatDuration(episode.durationSec)} ·{' '}
          {formatFileSize(episode.fileSizeBytes)}
        </div>
      </button>
      <div className="flex items-center gap-2">
        {episode.downloadStatus === 'downloading' || episode.downloadStatus === 'queued' ? (
          <span className="size-5 animate-spin rounded-full border-2 border-line border-t-amber-600" />
        ) : episode.isDownloaded ? (
          <CheckCircle2 className="size-4 text-success" strokeWidth={1.75} />
        ) : episode.downloadStatus === 'failed' ? (
          <AlertCircle className="size-4 text-danger" strokeWidth={1.75} />
        ) : null}
        {!episode.isDownloaded &&
        episode.downloadStatus !== 'queued' &&
        episode.downloadStatus !== 'downloading' ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="下载"
            onClick={onDownload}
            disabled={!onDownload}
          >
            <Download className="size-4" />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" aria-label={isCurrentPlaying ? '暂停' : '播放'} onClick={onPlay}>
          {isCurrentPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
