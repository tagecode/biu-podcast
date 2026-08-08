import i18n from '@/lib/i18n'
import type { Episode, Podcast } from '@shared/types'
import { create } from 'zustand'

import { canPlayEpisode } from './lib/offline-guard'
import { resolveMediaUrl } from './lib/media-url'
import { nextIndex, previousIndex, type QueueMode } from './lib/queue'

interface PlaybackState {
  currentEpisode: Episode | null
  currentPodcast: Podcast | null
  isPlaying: boolean
  currentTimeSec: number
  durationSec: number
  view: 'mini' | 'full'
  hasPrevious: boolean
  hasNext: boolean
  playbackError: string | null
  playbackRate: number
  setPlaybackRate: (rate: number) => void
  /** Remaining sleep-timer seconds; null when not armed. */
  sleepTimerRemaining: number | null
  setSleepTimer: (seconds: number | null) => void
  /** Current playback queue (independent of persistent playlists). */
  queueItems: Episode[]
  queueMode: QueueMode
  setQueueMode: (mode: QueueMode) => void
  addToQueue: (episode: Episode) => void
  playEpisode: (
    episode: Episode,
    podcast: Podcast,
    options?: { fromSec?: number }
  ) => Promise<boolean>
  restoreSession: (episode: Episode, podcast: Podcast, positionSec: number) => void
  togglePlay: () => void
  pause: () => void
  seek: (timeSec: number) => void
  setCurrentTime: (timeSec: number) => void
  setDuration: (durationSec: number) => void
  openFullPlayer: () => void
  closeFullPlayer: () => void
  playPrevious: () => Promise<void>
  playNext: () => Promise<void>
  refreshAdjacent: () => Promise<void>
  persistProgress: () => void
  clearPlaybackError: () => void
  /** Stop playback and clear the player if it's playing an episode of this podcast. */
  stopIfPlayingPodcast: (podcastId: string) => void
}

let audioElement: HTMLAudioElement | null = null
let lastPersistAt = 0
let sleepTimerHandle: ReturnType<typeof setInterval> | null = null
let openFullPlayerDefault = false

function getAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio()
    audioElement.preload = 'metadata'
  }
  return audioElement
}

async function persistNow(episodeId: string, positionSec: number): Promise<void> {
  lastPersistAt = Date.now()
  await window.api.playback.updateProgress({ episodeId, positionSec })
}

/**
 * Push current playback state to the OS media session (SMTC / MPRIS / Now
 * Playing). Best-effort: the media center is purely additive, so failures are
 * swallowed. Called on metadata change, play/pause, and position ticks.
 */
export function pushMediaSession(): void {
  const state = usePlaybackStore.getState()
  const { currentEpisode: episode, currentPodcast: podcast, isPlaying } = state
  if (!episode || !podcast) {
    return
  }
  void window.api.mediaSession
    .update({
      title: episode.title,
      artist: podcast.title,
      artworkUrl: podcast.coverUrl ?? undefined,
      durationSec: episode.durationSec ?? undefined,
      positionSec: getAudio().currentTime,
      playing: isPlaying
    })
    .catch(() => undefined)
}

/** Load persisted playback preferences (rate + full-player default). */
export async function loadPlaybackPrefs(): Promise<void> {
  try {
    const result = await window.api.settings.get()
    if (!result.ok) return
    openFullPlayerDefault = result.data.openFullPlayerDefault
    const rate = result.data.playbackRate
    if (rate && rate > 0) {
      usePlaybackStore.setState({ playbackRate: rate })
      getAudio().playbackRate = rate
    }
  } catch {
    // Non-fatal — defaults apply.
  }
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentEpisode: null,
  currentPodcast: null,
  isPlaying: false,
  currentTimeSec: 0,
  durationSec: 0,
  view: 'mini',
  hasPrevious: false,
  hasNext: false,
  playbackError: null,
  playbackRate: 1,
  setPlaybackRate: (rate) => {
    getAudio().playbackRate = rate
    set({ playbackRate: rate })
    void window.api.settings.set({ key: 'playbackRate', value: rate })
  },
  sleepTimerRemaining: null,
  setSleepTimer: (seconds) => {
    if (sleepTimerHandle) {
      clearInterval(sleepTimerHandle)
      sleepTimerHandle = null
    }
    if (seconds === null) {
      set({ sleepTimerRemaining: null })
      return
    }
    set({ sleepTimerRemaining: seconds })
    sleepTimerHandle = setInterval(() => {
      const state = usePlaybackStore.getState()
      const remaining = state.sleepTimerRemaining
      if (remaining === null) {
        if (sleepTimerHandle) clearInterval(sleepTimerHandle)
        sleepTimerHandle = null
        return
      }
      if (remaining <= 1) {
        // Timer done: pause playback.
        state.pause()
        state.setSleepTimer(null)
      } else {
        usePlaybackStore.setState({ sleepTimerRemaining: remaining - 1 })
      }
    }, 1000)
  },
  queueItems: [],
  queueMode: 'list',
  setQueueMode: (mode) => set({ queueMode: mode }),
  addToQueue: (episode) => {
    if (get().queueItems.some((e) => e.id === episode.id)) return
    set((state) => ({ queueItems: [...state.queueItems, episode] }))
  },
  playEpisode: async (episode, podcast, options) => {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    let playable = episode

    if (episode.isDownloaded) {
      const verified = await window.api.download.verifyLocal({ episodeId: episode.id })
      if (!verified.ok) {
        set({ playbackError: verified.error.message })
        return false
      }
      if (!verified.data.exists) {
        set({
          playbackError: i18n.t('playback.fileMissing'),
          currentEpisode: verified.data.episode,
          currentPodcast: podcast
        })
        return false
      }
      playable = verified.data.episode
    }

    const guard = canPlayEpisode(playable, online)
    if (!guard.ok) {
      set({ playbackError: guard.message })
      return false
    }

    const audio = getAudio()
    const prev = get().currentEpisode
    if (prev && prev.id !== playable.id) {
      void persistNow(prev.id, audio.currentTime)
    }

    const fromSec = options?.fromSec ?? playable.playbackPositionSec
    if (get().currentEpisode?.id !== playable.id) {
      audio.src = resolveMediaUrl(playable)
      audio.playbackRate = get().playbackRate
      audio.currentTime = fromSec
      set({
        currentEpisode: playable,
        currentPodcast: podcast,
        currentTimeSec: fromSec,
        durationSec: playable.durationSec ?? 0,
        hasPrevious: false,
        hasNext: false,
        playbackError: null,
        view: openFullPlayerDefault ? 'full' : get().view
      })
      void get().refreshAdjacent()
    } else {
      set({ playbackError: null })
    }
    void audio.play()
    set({ isPlaying: true })
    pushMediaSession()
    return true
  },
  restoreSession: (episode, podcast, positionSec) => {
    const audio = getAudio()
    audio.src = resolveMediaUrl(episode)
    audio.currentTime = positionSec
    set({
      currentEpisode: episode,
      currentPodcast: podcast,
      currentTimeSec: positionSec,
      durationSec: episode.durationSec ?? 0,
      isPlaying: false,
      hasPrevious: false,
      hasNext: false,
      playbackError: null
    })
    pushMediaSession()
    void get().refreshAdjacent()
  },
  clearPlaybackError: () => set({ playbackError: null }),
  togglePlay: () => {
    const audio = getAudio()
    if (!get().currentEpisode) return
    if (audio.paused) {
      void audio.play()
      set({ isPlaying: true })
    } else {
      audio.pause()
      set({ isPlaying: false })
      get().persistProgress()
    }
    pushMediaSession()
  },
  pause: () => {
    getAudio().pause()
    set({ isPlaying: false })
    get().persistProgress()
    pushMediaSession()
  },
  seek: (timeSec) => {
    const audio = getAudio()
    audio.currentTime = timeSec
    set({ currentTimeSec: timeSec })
    pushMediaSession()
  },
  setCurrentTime: (timeSec) => set({ currentTimeSec: timeSec }),
  setDuration: (durationSec) => set({ durationSec }),
  openFullPlayer: () => set({ view: 'full' }),
  closeFullPlayer: () => set({ view: 'mini' }),
  playPrevious: async () => {
    const { currentEpisode, currentPodcast, queueItems, queueMode } = get()
    if (!currentEpisode || !currentPodcast) return
    // Queue-aware: navigate the queue when the current episode is in it.
    const qIndex = queueItems.findIndex((e) => e.id === currentEpisode.id)
    if (qIndex >= 0) {
      const prev = previousIndex({
        items: queueItems,
        currentIndex: qIndex,
        mode: queueMode,
        shuffleOrder: []
      })
      if (prev !== null) {
        await get().playEpisode(queueItems[prev]!, currentPodcast, { fromSec: 0 })
      }
      return
    }
    const result = await window.api.episode.getAdjacent({ episodeId: currentEpisode.id })
    if (!result.ok || !result.data.previous) return
    await get().playEpisode(result.data.previous, currentPodcast, { fromSec: 0 })
  },
  playNext: async () => {
    const { currentEpisode, currentPodcast, queueItems, queueMode } = get()
    if (!currentEpisode || !currentPodcast) return
    // Queue-aware: navigate the queue when the current episode is in it.
    const qIndex = queueItems.findIndex((e) => e.id === currentEpisode.id)
    if (qIndex >= 0) {
      const next = nextIndex({
        items: queueItems,
        currentIndex: qIndex,
        mode: queueMode,
        shuffleOrder: []
      })
      if (next !== null) {
        await get().playEpisode(queueItems[next]!, currentPodcast, { fromSec: 0 })
      }
      return
    }
    const result = await window.api.episode.getAdjacent({ episodeId: currentEpisode.id })
    if (!result.ok || !result.data.next) return
    await get().playEpisode(result.data.next, currentPodcast, { fromSec: 0 })
  },
  refreshAdjacent: async () => {
    const episode = get().currentEpisode
    if (!episode) {
      set({ hasPrevious: false, hasNext: false })
      return
    }
    const result = await window.api.episode.getAdjacent({ episodeId: episode.id })
    if (!result.ok) return
    set({
      hasPrevious: Boolean(result.data.previous),
      hasNext: Boolean(result.data.next)
    })
  },
  persistProgress: () => {
    const episode = get().currentEpisode
    if (!episode) return
    void persistNow(episode.id, getAudio().currentTime)
  },
  stopIfPlayingPodcast: (podcastId) => {
    const episode = get().currentEpisode
    if (!episode || episode.podcastId !== podcastId) return
    const audio = getAudio()
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    set({
      currentEpisode: null,
      currentPodcast: null,
      isPlaying: false,
      currentTimeSec: 0,
      durationSec: 0,
      hasPrevious: false,
      hasNext: false,
      playbackError: null
    })
  }
}))

export function bindAudioEvents(target?: HTMLAudioElement): () => void {
  const audio = target ?? getAudio()

  const onTimeUpdate = (): void => {
    const state = usePlaybackStore.getState()
    state.setCurrentTime(audio.currentTime)
    if (!state.currentEpisode) return
    const now = Date.now()
    if (now - lastPersistAt >= 5000) {
      void persistNow(state.currentEpisode.id, audio.currentTime)
    }
  }
  const onLoadedMetadata = (): void => {
    usePlaybackStore.getState().setDuration(audio.duration)
  }
  const onEnded = (): void => {
    const state = usePlaybackStore.getState()
    state.persistProgress()
    // Finished playing → mark the episode as played (updates unread count).
    const finished = state.currentEpisode
    if (finished) {
      void window.api.episode.markPlayed({ episodeId: finished.id })
    }
    if (state.hasNext) {
      void state.playNext()
    } else {
      usePlaybackStore.setState({ isPlaying: false })
    }
  }
  const onPlay = (): void => {
    usePlaybackStore.setState({ isPlaying: true })
    pushMediaSession()
  }
  const onPause = (): void => {
    usePlaybackStore.setState({ isPlaying: false })
    pushMediaSession()
  }

  audio.addEventListener('timeupdate', onTimeUpdate)
  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)

  return () => {
    audio.removeEventListener('timeupdate', onTimeUpdate)
    audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    audio.removeEventListener('ended', onEnded)
    audio.removeEventListener('play', onPlay)
    audio.removeEventListener('pause', onPause)
  }
}
