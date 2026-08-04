import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/lib/format'
import type { DownloadTask } from '@shared/types'

import { useDownloadStore } from '../store'

function statusLabel(task: DownloadTask): string {
  switch (task.status) {
    case 'downloading':
      return '下载中'
    case 'queued':
      return '等待中'
    case 'paused':
      return '已暂停'
    case 'failed':
      return '失败'
    case 'completed':
      return '已完成'
    default:
      return task.status
  }
}

function progressPercent(task: DownloadTask): number {
  if (!task.totalBytes || task.totalBytes <= 0) return 0
  return Math.min(100, Math.round((task.progressBytes / task.totalBytes) * 100))
}

export function DownloadPanel(): React.JSX.Element | null {
  const panelOpen = useDownloadStore((state) => state.panelOpen)
  const tasks = useDownloadStore((state) => state.tasks)
  const setPanelOpen = useDownloadStore((state) => state.setPanelOpen)
  const pause = useDownloadStore((state) => state.pause)
  const resume = useDownloadStore((state) => state.resume)
  const cancel = useDownloadStore((state) => state.cancel)

  if (!panelOpen) return null

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <span className="text-sm font-medium text-ink">下载队列 · {tasks.length} 项</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="关闭下载队列"
          onClick={() => setPanelOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">暂无下载任务</div>
        ) : (
          tasks.map((task) => {
            const percent = progressPercent(task)
            return (
              <div key={task.id} className="border-b border-line px-4 py-3">
                <div className="truncate text-sm font-medium text-ink">
                  {task.episodeTitle ?? task.episodeId}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {task.podcastTitle ?? '未知播客'} · {formatFileSize(task.totalBytes)} ·{' '}
                  {statusLabel(task)}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-amber-600 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-2 flex gap-3">
                  {task.status === 'downloading' || task.status === 'queued' ? (
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-ink"
                      onClick={() => void pause(task.id)}
                    >
                      暂停
                    </button>
                  ) : null}
                  {task.status === 'paused' || task.status === 'failed' ? (
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-ink"
                      onClick={() => void resume(task.id)}
                    >
                      {task.status === 'failed' ? '重试' : '继续'}
                    </button>
                  ) : null}
                  {task.status !== 'completed' ? (
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-ink"
                      onClick={() => void cancel(task.id)}
                    >
                      取消
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
