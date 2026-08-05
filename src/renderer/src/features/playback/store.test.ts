import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAudioEvents, usePlaybackStore } from './store'

describe('playback store ended handler', () => {
  const markPlayed = vi.fn(() => Promise.resolve({ ok: true as const, data: { changed: true } }))

  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      episode: { markPlayed },
      playback: {
        updateProgress: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
        getLastSession: vi.fn(() => Promise.resolve({ ok: true as const, data: null }))
      }
    } as unknown as Window['api']
    // Reset store between tests.
    usePlaybackStore.setState({
      currentEpisode: null,
      currentPodcast: null,
      isPlaying: false,
      hasNext: false,
      playbackError: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('marks the finished episode as played on ended', () => {
    const episode = {
      id: 'ep-1',
      podcastId: 'pod-1',
      title: 'EP',
      descriptionHtml: null,
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep.mp3',
      durationSec: 60,
      fileSizeBytes: 1,
      isPlayed: false,
      playbackPositionSec: 0,
      isDownloaded: false,
      localFilePath: null,
      downloadStatus: null,
      downloadedAt: null,
      guid: 'g1'
    }
    usePlaybackStore.setState({
      currentEpisode: episode,
      hasNext: false,
      isPlaying: true
    })

    const audio = document.createElement('audio')
    const unsubscribe = bindAudioEvents(audio)
    audio.dispatchEvent(new Event('ended'))

    expect(markPlayed).toHaveBeenCalledWith({ episodeId: 'ep-1' })
    unsubscribe()
  })

  it('does not call markPlayed when there is no current episode', () => {
    const audio = document.createElement('audio')
    const unsubscribe = bindAudioEvents(audio)
    audio.dispatchEvent(new Event('ended'))

    expect(markPlayed).not.toHaveBeenCalled()
    unsubscribe()
  })
})
