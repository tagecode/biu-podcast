import { Download, Link2, ListPlus, ListVideo, Pause, Play, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Episode, Note, Playlist } from '@shared/types'

import { formatDate, formatDuration, formatFileSize } from '@/lib/format'
import { usePlaybackStore } from '@/features/playback/store'
import * as playlistApi from '@/features/playlist/api'

import { copyShareUrl, episodeShareUrl } from '../lib/share-link'
import { linkifyTimestamps, clampTimestamp } from '../lib/timestamp-link'
import * as episodeApi from '../api'
import type { Chapter } from '@shared/types'

interface EpisodeDetailPanelProps {
  episode: Episode
  onClose: () => void
  onPlay: () => void
  /** Play this episode starting at a given position (timestamp links). */
  onPlayFrom?: (seconds: number) => void
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
  onPlayFrom,
  onDownload,
  isCurrentPlaying,
  currentPositionSec
}: EpisodeDetailPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])

  useEffect(() => {
    void playlistApi.listPlaylists().then((r) => setPlaylists(r))
    void playlistApi.listNotesByEpisode(episode.id).then((r) => setNotes(r))
  }, [episode.id])

  // Load chapter list when the episode's feed provides a chapters URL.
  // (Chapters state is per-episode; the panel remounts per selected episode.)
  useEffect(() => {
    if (!episode.chaptersUrl) return
    let cancelled = false
    void episodeApi.getChapters(episode.id).then((c) => {
      if (!cancelled) setChapters(c)
    })
    return () => {
      cancelled = true
    }
  }, [episode.id, episode.chaptersUrl])

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

  /** Jump to a timestamp in the description: seek if this episode is current,
      otherwise play it from that position. Clamp to the episode duration so a
      timestamp beyond the end can't seek past the track. */
  const jumpToTimestamp = (seconds: number): void => {
    const target = clampTimestamp(seconds, episode.durationSec)
    const playback = usePlaybackStore.getState()
    if (playback.currentEpisode?.id === episode.id) {
      playback.seek(target)
    } else if (onPlayFrom) {
      onPlayFrom(target)
    } else {
      onPlay()
    }
  }

  const handleDescriptionClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    if (target.tagName !== 'BUTTON' || !target.dataset.ts) return
    event.preventDefault()
    const seconds = Number(target.dataset.ts)
    if (Number.isFinite(seconds)) jumpToTimestamp(seconds)
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
        <Button variant="ghost" size="icon" aria-label={t('episode.closeDetail')} onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
        <Button onClick={onPlay}>
          {isCurrentPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isCurrentPlaying ? t('episode.pause') : t('episode.play')}
        </Button>
        {!episode.isDownloaded && onDownload ? (
          <Button variant="secondary" onClick={onDownload}>
            <Download className="size-4" />
            {t('episode.download')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('episode.addToQueue')}
          onClick={() => addToQueue()}
        >
          <ListVideo className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('episode.copyLink')}
          onClick={() => void copyShareUrl(episodeShareUrl(episode))}
        >
          <Link2 className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-ink">{t('episode.addToPlaylist')}</div>
          {playlists.length === 0 ? (
            <p className="text-xs text-muted">{t('playlist.emptyHint')}</p>
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
          <div className="mb-1.5 text-sm font-medium text-ink">{t('note.timestampNotes')}</div>
          {currentPositionSec !== undefined ? (
            <p className="mb-1.5 text-xs text-muted">
              {t('note.currentPosition', { time: formatTimestamp(currentPositionSec) })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input
              placeholder={t('note.addPlaceholder')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addNote()
              }}
            />
            <Button size="sm" onClick={() => void addNote()} disabled={!noteText.trim()}>
              {t('note.add')}
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
                    aria-label={t('note.delete')}
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

        {chapters.length > 0 ? (
          <div className="mb-4">
            <div className="mb-1.5 text-sm font-medium text-ink">{t('episode.chapters')}</div>
            <ol className="space-y-1">
              {chapters.map((chapter, index) => (
                <li key={`${chapter.startTime}-${index}`}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-amber-100/50"
                    onClick={() => jumpToTimestamp(chapter.startTime)}
                  >
                    <span className="shrink-0 font-mono text-amber-700">
                      {formatTimestamp(chapter.startTime)}
                    </span>
                    <span className="min-w-0 flex-1 text-ink">{chapter.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {episode.descriptionHtml ? (
          <div
            className="episode-html text-sm leading-6 text-ink [&_.ts-link]:text-amber-700 [&_.ts-link]:underline [&_.ts-link]:cursor-pointer [&_a]:text-amber-700 [&_a]:underline [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            // Sanitized in main process via sanitizeRichHtml before IPC;
            // timestamps are turned into buttons here (linkifyTimestamps).
            dangerouslySetInnerHTML={{
              __html: linkifyTimestamps(episode.descriptionHtml) ?? ''
            }}
            onClick={handleDescriptionClick}
          />
        ) : (
          <p className="text-sm text-muted">{t('episode.noDescription')}</p>
        )}
      </div>
    </aside>
  )
}
