import { Download, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Note } from '@shared/types'

import * as playlistApi from '../api'

interface NotesPageProps {
  onBack: () => void
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function NotesPage({ onBack }: NotesPageProps): React.JSX.Element {
  const [notes, setNotes] = useState<Note[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      const loaded = await playlistApi.listAllNotes()
      setNotes(loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载笔记失败')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void load()
  }, [])

  const handleExport = async (): Promise<void> => {
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.note.export()
      if (!result.ok || !result.data) {
        setMessage('已取消导出')
        return
      }
      setMessage(`已导出笔记到：${result.data.filePath}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    await playlistApi.deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={onBack}>
          返回
        </button>
        <h1 className="text-base font-semibold text-ink">笔记</h1>
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => void handleExport()}>
          <Download className="size-4" />
          导出 Markdown
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {error ? (
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-line bg-amber-100/50 p-3 text-sm text-ink whitespace-pre-wrap">
            {message}
          </div>
        ) : null}
        {notes.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            还没有笔记 —— 在集数详情中写一条时间戳笔记
          </p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-3 rounded-md border border-line bg-surface px-4 py-3"
              >
                <span className="shrink-0 font-mono text-xs text-amber-700">
                  {formatTimestamp(note.timestampSec)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{note.episodeTitle}</div>
                  <div className="mt-0.5 text-sm text-muted">{note.content}</div>
                </div>
                <button
                  type="button"
                  aria-label="删除笔记"
                  className="text-muted hover:text-danger"
                  onClick={() => void handleDelete(note.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
