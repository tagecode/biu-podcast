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

describe('playback store stopIfPlayingPodcast', () => {
  beforeEach(() => {
    window.api = {
      episode: { markPlayed: vi.fn() },
      playback: {
        updateProgress: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
        getLastSession: vi.fn(() => Promise.resolve({ ok: true as const, data: null }))
      }
    } as unknown as Window['api']
    usePlaybackStore.setState({
      currentEpisode: null,
      currentPodcast: null,
      isPlaying: false,
      hasNext: false,
      playbackError: null
    })
  })

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

  it('clears the player when the playing episode belongs to the deleted podcast', () => {
    usePlaybackStore.setState({
      currentEpisode: episode,
      currentPodcast: { id: 'pod-1', title: 'P', feedUrl: 'f' } as never,
      isPlaying: true
    })
    usePlaybackStore.getState().stopIfPlayingPodcast('pod-1')

    const state = usePlaybackStore.getState()
    expect(state.currentEpisode).toBeNull()
    expect(state.currentPodcast).toBeNull()
    expect(state.isPlaying).toBe(false)
  })

  it('leaves the player untouched when the deleted podcast differs', () => {
    usePlaybackStore.setState({
      currentEpisode: episode,
      currentPodcast: { id: 'pod-1', title: 'P', feedUrl: 'f' } as never,
      isPlaying: true
    })
    usePlaybackStore.getState().stopIfPlayingPodcast('pod-2')

    const state = usePlaybackStore.getState()
    expect(state.currentEpisode?.id).toBe('ep-1')
    expect(state.isPlaying).toBe(true)
  })
})

describe('playback store queue + rate', () => {
  beforeEach(() => {
    window.api = {
      episode: { markPlayed: vi.fn() },
      playback: {
        updateProgress: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined })),
        getLastSession: vi.fn(() => Promise.resolve({ ok: true as const, data: null }))
      },
      settings: {
        get: vi.fn(() =>
          Promise.resolve({
            ok: true as const,
            data: { playbackRate: 1, openFullPlayerDefault: false }
          })
        ),
        set: vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }))
      }
    } as unknown as Window['api']
    usePlaybackStore.setState({
      queueItems: [],
      queueMode: 'list',
      playbackRate: 1,
      sleepTimerRemaining: null,
      currentEpisode: null,
      currentPodcast: null,
      isPlaying: false
    })
  })

  it('setPlaybackRate updates the store and persists', () => {
    usePlaybackStore.getState().setPlaybackRate(1.5)
    expect(usePlaybackStore.getState().playbackRate).toBe(1.5)
    expect(window.api.settings.set).toHaveBeenCalledWith({ key: 'playbackRate', value: 1.5 })
  })

  it('addToQueue dedupes by episode id', () => {
    const e1 = { id: 'e1' } as never
    const e2 = { id: 'e2' } as never
    const store = usePlaybackStore.getState()
    store.addToQueue(e1)
    store.addToQueue(e1)
    store.addToQueue(e2)
    expect(usePlaybackStore.getState().queueItems.map((i) => (i as { id: string }).id)).toEqual([
      'e1',
      'e2'
    ])
  })

  it('setQueueMode cycles modes', () => {
    const store = usePlaybackStore.getState()
    store.setQueueMode('repeat-one')
    expect(usePlaybackStore.getState().queueMode).toBe('repeat-one')
    store.setQueueMode('shuffle')
    expect(usePlaybackStore.getState().queueMode).toBe('shuffle')
  })
})
