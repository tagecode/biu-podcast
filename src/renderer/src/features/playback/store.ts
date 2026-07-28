import type { Episode, Podcast } from '@shared/types'
import { create } from 'zustand'

interface PlaybackEpisodeContext {
  episode: Episode
  podcast: Podcast
}

interface PlaybackState {
  currentEpisode: Episode | null
  currentPodcast: Podcast | null
  isPlaying: boolean
  currentTimeSec: number
  durationSec: number
  view: 'mini' | 'full'
  playEpisode: (episode: Episode, podcast: Podcast) => void
  togglePlay: () => void
  pause: () => void
  seek: (timeSec: number) => void
  setCurrentTime: (timeSec: number) => void
  setDuration: (durationSec: number) => void
  openFullPlayer: () => void
  closeFullPlayer: () => void
}

let audioElement: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio()
    audioElement.preload = 'metadata'
  }
  return audioElement
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentEpisode: null,
  currentPodcast: null,
  isPlaying: false,
  currentTimeSec: 0,
  durationSec: 0,
  view: 'mini',
  playEpisode: (episode, podcast) => {
    const audio = getAudio()
    if (get().currentEpisode?.id !== episode.id) {
      audio.src = episode.audioUrl
      audio.currentTime = episode.playbackPositionSec
      set({
        currentEpisode: episode,
        currentPodcast: podcast,
        currentTimeSec: episode.playbackPositionSec,
        durationSec: episode.durationSec ?? 0
      })
    }
    void audio.play()
    set({ isPlaying: true })
  },
  togglePlay: () => {
    const audio = getAudio()
    if (!get().currentEpisode) return
    if (audio.paused) {
      void audio.play()
      set({ isPlaying: true })
    } else {
      audio.pause()
      set({ isPlaying: false })
    }
  },
  pause: () => {
    getAudio().pause()
    set({ isPlaying: false })
  },
  seek: (timeSec) => {
    const audio = getAudio()
    audio.currentTime = timeSec
    set({ currentTimeSec: timeSec })
  },
  setCurrentTime: (timeSec) => set({ currentTimeSec: timeSec }),
  setDuration: (durationSec) => set({ durationSec }),
  openFullPlayer: () => set({ view: 'full' }),
  closeFullPlayer: () => set({ view: 'mini' })
}))

export function bindAudioEvents(): () => void {
  const audio = getAudio()

  const onTimeUpdate = (): void => {
    usePlaybackStore.getState().setCurrentTime(audio.currentTime)
  }
  const onLoadedMetadata = (): void => {
    usePlaybackStore.getState().setDuration(audio.duration)
  }
  const onEnded = (): void => {
    usePlaybackStore.getState().pause()
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

export type { PlaybackEpisodeContext }
