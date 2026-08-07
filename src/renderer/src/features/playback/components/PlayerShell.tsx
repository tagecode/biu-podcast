import {
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward
} from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format'

import { bindAudioEvents, usePlaybackStore } from '../store'

export function MiniPlayer(): React.JSX.Element | null {
  const currentEpisode = usePlaybackStore((state) => state.currentEpisode)
  const currentPodcast = usePlaybackStore((state) => state.currentPodcast)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const currentTimeSec = usePlaybackStore((state) => state.currentTimeSec)
  const durationSec = usePlaybackStore((state) => state.durationSec)
  const hasPrevious = usePlaybackStore((state) => state.hasPrevious)
  const hasNext = usePlaybackStore((state) => state.hasNext)
  const playbackError = usePlaybackStore((state) => state.playbackError)
  const togglePlay = usePlaybackStore((state) => state.togglePlay)
  const playPrevious = usePlaybackStore((state) => state.playPrevious)
  const playNext = usePlaybackStore((state) => state.playNext)
  const openFullPlayer = usePlaybackStore((state) => state.openFullPlayer)
  const clearPlaybackError = usePlaybackStore((state) => state.clearPlaybackError)
  const queueMode = usePlaybackStore((state) => state.queueMode)
  const setQueueMode = usePlaybackStore((state) => state.setQueueMode)

  useEffect(() => bindAudioEvents(), [])

  if (playbackError && !currentEpisode) {
    return (
      <div className="shrink-0 border-t border-line bg-danger/5 px-6 py-3 text-sm text-danger">
        {playbackError}
        <button type="button" className="ml-3 underline" onClick={clearPlaybackError}>
          关闭
        </button>
      </div>
    )
  }

  if (!currentEpisode || !currentPodcast) return null

  const progress = durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0

  return (
    <div className="relative shrink-0 border-t border-line bg-surface">
      {playbackError ? (
        <div className="border-b border-danger/20 bg-danger/5 px-6 py-2 text-xs text-danger">
          {playbackError}
          <button type="button" className="ml-3 underline" onClick={clearPlaybackError}>
            关闭
          </button>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-line">
        <div className="h-full bg-amber-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex h-[72px] items-center gap-4 px-6">
        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-line">
          {currentPodcast.coverUrl ? (
            <img
              src={currentPodcast.coverUrl}
              alt={currentPodcast.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-amber-100 text-lg font-semibold text-muted">
              {currentPodcast.title.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{currentEpisode.title}</div>
          <div className="truncate text-xs text-muted">{currentPodcast.title}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="上一集"
            disabled={!hasPrevious}
            onClick={() => void playPrevious()}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-amber-600 hover:bg-amber-500"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="size-4 text-ink" />
            ) : (
              <Play className="size-4 text-ink" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="下一集"
            disabled={!hasNext}
            onClick={() => void playNext()}
          >
            <SkipForward className="size-4" />
          </Button>
        </div>
        <div className="font-mono text-xs text-muted">
          {formatDuration(currentTimeSec)} / {formatDuration(durationSec)}
        </div>
        <button
          type="button"
          aria-label={`播放模式：${queueMode === 'list' ? '列表循环' : queueMode === 'repeat-one' ? '单曲循环' : '随机播放'}`}
          className="text-muted-700 hover:text-ink"
          onClick={() =>
            setQueueMode(
              queueMode === 'list' ? 'repeat-one' : queueMode === 'repeat-one' ? 'shuffle' : 'list'
            )
          }
        >
          {queueMode === 'list' ? (
            <Repeat className="size-4" strokeWidth={1.75} />
          ) : queueMode === 'repeat-one' ? (
            <Repeat1 className="size-4 text-amber-600" strokeWidth={1.75} />
          ) : (
            <Shuffle className="size-4 text-amber-600" strokeWidth={1.75} />
          )}
        </button>
        <Button variant="ghost" size="icon" onClick={openFullPlayer} aria-label="展开播放器">
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function FullScreenPlayer(): React.JSX.Element | null {
  const currentEpisode = usePlaybackStore((state) => state.currentEpisode)
  const currentPodcast = usePlaybackStore((state) => state.currentPodcast)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const currentTimeSec = usePlaybackStore((state) => state.currentTimeSec)
  const durationSec = usePlaybackStore((state) => state.durationSec)
  const view = usePlaybackStore((state) => state.view)
  const hasPrevious = usePlaybackStore((state) => state.hasPrevious)
  const hasNext = usePlaybackStore((state) => state.hasNext)
  const togglePlay = usePlaybackStore((state) => state.togglePlay)
  const playPrevious = usePlaybackStore((state) => state.playPrevious)
  const playNext = usePlaybackStore((state) => state.playNext)
  const seek = usePlaybackStore((state) => state.seek)
  const closeFullPlayer = usePlaybackStore((state) => state.closeFullPlayer)
  const playbackRate = usePlaybackStore((state) => state.playbackRate)
  const setPlaybackRate = usePlaybackStore((state) => state.setPlaybackRate)
  const sleepTimerRemaining = usePlaybackStore((state) => state.sleepTimerRemaining)
  const setSleepTimer = usePlaybackStore((state) => state.setSleepTimer)

  // Keyboard shortcuts: Space = play/pause, ←/→ = ±10s, ↑/↓ = volume.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const state = usePlaybackStore.getState()
      if (event.code === 'Space') {
        event.preventDefault()
        state.togglePlay()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        state.seek(Math.min(state.durationSec, state.currentTimeSec + 10))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        state.seek(Math.max(0, state.currentTimeSec - 10))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const audio = document.querySelector('audio')
        if (audio) audio.volume = Math.min(1, audio.volume + 0.1)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        const audio = document.querySelector('audio')
        if (audio) audio.volume = Math.max(0, audio.volume - 0.1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!currentEpisode || !currentPodcast || view !== 'full') return null

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-paper">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          className="text-sm text-muted hover:text-ink"
          onClick={closeFullPlayer}
        >
          收起播放器
        </button>
        <Select value={String(playbackRate)} onValueChange={(v) => setPlaybackRate(Number(v))}>
          <SelectTrigger className="w-24" aria-label="播放速度">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((rate) => (
              <SelectItem key={rate} value={String(rate)}>
                {rate}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sleepTimerRemaining !== null ? (
          <div className="flex items-center gap-2 text-sm text-amber-700">
            睡眠 {Math.ceil(sleepTimerRemaining / 60)}:
            {String(sleepTimerRemaining % 60).padStart(2, '0')}
            <button
              type="button"
              aria-label="取消睡眠定时器"
              className="text-muted hover:text-danger"
              onClick={() => setSleepTimer(null)}
            >
              ×
            </button>
          </div>
        ) : (
          <Select value="off" onValueChange={(v) => setSleepTimer(v === 'off' ? null : Number(v))}>
            <SelectTrigger className="w-24" aria-label="睡眠定时器">
              <SelectValue placeholder="睡眠" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">关闭</SelectItem>
              {[10, 30, 60, 300, 900, 1800, 3600].map((sec) => (
                <SelectItem key={sec} value={String(sec)}>
                  {sec < 60 ? `${sec}s` : sec < 3600 ? `${sec / 60} 分钟` : `${sec / 3600} 小时`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="mb-8 size-[280px] overflow-hidden rounded-lg bg-line shadow-md">
          {currentPodcast.coverUrl ? (
            <img
              src={currentPodcast.coverUrl}
              alt={currentPodcast.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-line text-7xl font-semibold text-muted">
              {currentPodcast.title.charAt(0)}
            </div>
          )}
        </div>
        <h1 className="max-w-2xl text-center text-2xl font-semibold text-ink">
          {currentEpisode.title}
        </h1>
        <p className="mt-2 text-base text-muted">{currentPodcast.title}</p>
        <div className="mt-8 w-full max-w-xl">
          <input
            type="range"
            min={0}
            max={Math.max(durationSec, 1)}
            value={currentTimeSec}
            className="w-full accent-amber-600"
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div className="mt-2 flex justify-between font-mono text-xs text-muted">
            <span>{formatDuration(currentTimeSec)}</span>
            <span>{formatDuration(durationSec)}</span>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-12"
            aria-label="上一集"
            disabled={!hasPrevious}
            onClick={() => void playPrevious()}
          >
            <SkipBack className="size-6" />
          </Button>
          <Button size="lg" className={cn('size-16 rounded-full p-0')} onClick={togglePlay}>
            {isPlaying ? <Pause className="size-6" /> : <Play className="size-6" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-12"
            aria-label="下一集"
            disabled={!hasNext}
            onClick={() => void playNext()}
          >
            <SkipForward className="size-6" />
          </Button>
        </div>
      </div>
    </div>
  )
}
