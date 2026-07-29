import { Download, Play, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Episode } from '@shared/types'

import { formatDate, formatDuration, formatFileSize } from '../lib/format'

interface EpisodeDetailPanelProps {
  episode: Episode
  onClose: () => void
  onPlay: () => void
  onDownload?: () => void
}

export function EpisodeDetailPanel({
  episode,
  onClose,
  onPlay,
  onDownload
}: EpisodeDetailPanelProps): React.JSX.Element {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line px-4 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">{episode.title}</h2>
          <p className="mt-1 font-mono text-xs text-muted">
            {formatDate(episode.publishedAt)} · {formatDuration(episode.durationSec)} ·{' '}
            {formatFileSize(episode.fileSizeBytes)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="关闭集数详情" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex gap-2 border-b border-line px-4 py-3">
        <Button onClick={onPlay}>
          <Play className="size-4" />
          播放
        </Button>
        {!episode.isDownloaded && onDownload ? (
          <Button variant="secondary" onClick={onDownload}>
            <Download className="size-4" />
            下载
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {episode.descriptionHtml ? (
          <div
            className="episode-html text-sm leading-6 text-ink [&_a]:text-amber-700 [&_a]:underline [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            // Sanitized in main process via sanitizeRichHtml before IPC.
            dangerouslySetInnerHTML={{ __html: episode.descriptionHtml }}
          />
        ) : (
          <p className="text-sm text-muted">暂无集数简介</p>
        )}
      </div>
    </aside>
  )
}
