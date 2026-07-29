import type { Episode, Podcast } from '@shared/types'
import { create } from 'zustand'

import { canPlayEpisode } from './lib/offline-guard'
import { resolveMediaUrl } from './lib/media-url'

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
  playEpisode: (episode: Episode, podcast: Podcast, options?: { fromSec?: number }) => boolean
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
}

let audioElement: HTMLAudioElement | null = null
let lastPersistAt = 0

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
  playEpisode: (episode, podcast, options) => {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    const guard = canPlayEpisode(episode, online)
    if (!guard.ok) {
      set({ playbackError: guard.message })
      return false
    }

    const audio = getAudio()
    const prev = get().currentEpisode
    if (prev && prev.id !== episode.id) {
      void persistNow(prev.id, audio.currentTime)
    }

    const fromSec = options?.fromSec ?? episode.playbackPositionSec
    if (get().currentEpisode?.id !== episode.id) {
      audio.src = resolveMediaUrl(episode)
      audio.currentTime = fromSec
      set({
        currentEpisode: episode,
        currentPodcast: podcast,
        currentTimeSec: fromSec,
        durationSec: episode.durationSec ?? 0,
        hasPrevious: false,
        hasNext: false,
        playbackError: null
      })
      void get().refreshAdjacent()
    } else {
      set({ playbackError: null })
    }
    void audio.play()
    set({ isPlaying: true })
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
  },
  pause: () => {
    getAudio().pause()
    set({ isPlaying: false })
    get().persistProgress()
  },
  seek: (timeSec) => {
    const audio = getAudio()
    audio.currentTime = timeSec
    set({ currentTimeSec: timeSec })
  },
  setCurrentTime: (timeSec) => set({ currentTimeSec: timeSec }),
  setDuration: (durationSec) => set({ durationSec }),
  openFullPlayer: () => set({ view: 'full' }),
  closeFullPlayer: () => set({ view: 'mini' }),
  playPrevious: async () => {
    const { currentEpisode, currentPodcast } = get()
    if (!currentEpisode || !currentPodcast) return
    const result = await window.api.episode.getAdjacent({ episodeId: currentEpisode.id })
    if (!result.ok || !result.data.previous) return
    get().playEpisode(result.data.previous, currentPodcast, { fromSec: 0 })
  },
  playNext: async () => {
    const { currentEpisode, currentPodcast } = get()
    if (!currentEpisode || !currentPodcast) return
    const result = await window.api.episode.getAdjacent({ episodeId: currentEpisode.id })
    if (!result.ok || !result.data.next) return
    get().playEpisode(result.data.next, currentPodcast, { fromSec: 0 })
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
  }
}))

export function bindAudioEvents(): () => void {
  const audio = getAudio()

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
    if (state.hasNext) {
      void state.playNext()
    } else {
      usePlaybackStore.setState({ isPlaying: false })
    }
  }
  const onPlay = (): void => usePlaybackStore.setState({ isPlaying: true })
  const onPause = (): void => usePlaybackStore.setState({ isPlaying: false })

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
