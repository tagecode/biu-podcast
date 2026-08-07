import { Download, ListPlus, ListVideo, Pause, Play, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Episode, Note, Playlist } from '@shared/types'

import { formatDate, formatDuration, formatFileSize } from '@/lib/format'
import { usePlaybackStore } from '@/features/playback/store'
import * as playlistApi from '@/features/playlist/api'

interface EpisodeDetailPanelProps {
  episode: Episode
  onClose: () => void
  onPlay: () => void
  onDownload?: () => void
  /** This episode is the current track AND audio is playing — show pause. */
  isCurrentPlaying?: boolean
  /** Current playback position in seconds, for timestamp notes. */
  currentPositionSec?: number
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function EpisodeDetailPanel({
  episode,
  onClose,
  onPlay,
  onDownload,
  isCurrentPlaying,
  currentPositionSec
}: EpisodeDetailPanelProps): React.JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    void playlistApi.listPlaylists().then((r) => setPlaylists(r))
    void playlistApi.listNotesByEpisode(episode.id).then((r) => setNotes(r))
  }, [episode.id])

  const addToPlaylist = async (playlistId: string): Promise<void> => {
    await playlistApi.addToPlaylist(playlistId, episode.id)
  }

  const addToQueue = (): void => {
    usePlaybackStore.getState().addToQueue(episode)
  }

  const addNote = async (): Promise<void> => {
    if (!noteText.trim()) return
    const ts = currentPositionSec ?? 0
    const note = await playlistApi.createNote(episode.id, ts, noteText.trim())
    setNotes((prev) => [note, ...prev])
    setNoteText('')
  }

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

      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
        <Button onClick={onPlay}>
          {isCurrentPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isCurrentPlaying ? '暂停' : '播放'}
        </Button>
        {!episode.isDownloaded && onDownload ? (
          <Button variant="secondary" onClick={onDownload}>
            <Download className="size-4" />
            下载
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" aria-label="加入播放队列" onClick={() => addToQueue()}>
          <ListVideo className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-ink">添加到播放列表</div>
          {playlists.length === 0 ? (
            <p className="text-xs text-muted">暂无播放列表，去「播放列表」页创建</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {playlists.map((playlist) => (
                <Button
                  key={playlist.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => void addToPlaylist(playlist.id)}
                >
                  <ListPlus className="size-3.5" />
                  {playlist.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-ink">时间戳笔记</div>
          {currentPositionSec !== undefined ? (
            <p className="mb-1.5 text-xs text-muted">
              当前进度 {formatTimestamp(currentPositionSec)}，将记录在此时间点
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input
              placeholder="写一条笔记…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addNote()
              }}
            />
            <Button size="sm" onClick={() => void addNote()} disabled={!noteText.trim()}>
              添加
            </Button>
          </div>
          {notes.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-2 rounded-md border border-line bg-paper px-2.5 py-1.5"
                >
                  <span className="shrink-0 font-mono text-xs text-amber-700">
                    {formatTimestamp(note.timestampSec)}
                  </span>
                  <span className="min-w-0 flex-1 text-xs text-ink">{note.content}</span>
                  <button
                    type="button"
                    aria-label="删除笔记"
                    className="text-xs text-muted hover:text-danger"
                    onClick={() => {
                      void playlistApi
                        .deleteNote(note.id)
                        .then(() => setNotes((prev) => prev.filter((n) => n.id !== note.id)))
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

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
