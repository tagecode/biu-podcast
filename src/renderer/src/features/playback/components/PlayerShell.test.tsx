import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Episode, Podcast } from '@shared/types'

import { MiniPlayer } from './PlayerShell'
import { usePlaybackStore } from '../store'

function makePodcast(): Podcast {
  return {
    id: 'pod-1',
    feedUrl: 'https://example.com/feed.xml',
    title: '科技早知道',
    description: null,
    coverUrl: null,
    author: null,
    language: null,
    isPaused: false,
    subscribedAt: 1,
    lastFetchedAt: null,
    lastFetchStatus: null
  }
}

function makeEpisode(): Episode {
  return {
    id: 'ep-1',
    podcastId: 'pod-1',
    title: 'AI 周报',
    descriptionHtml: null,
    publishedAt: 1,
    audioUrl: 'https://example.com/ep.mp3',
    durationSec: 600,
    fileSizeBytes: 1,
    isPlayed: false,
    playbackPositionSec: 0,
    isDownloaded: false,
    localFilePath: null,
    downloadStatus: null,
    downloadedAt: null,
    guid: 'g1'
  }
}

describe('MiniPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      playback: {
        getRegisteredShortcuts: vi.fn(async () => ({ ok: true as const, data: {} })),
        updateProgress: vi.fn(async () => ({ ok: true as const, data: undefined }))
      },
      episode: { markPlayed: vi.fn(async () => ({ ok: true as const, data: { changed: true } })) },
      mediaSession: { update: vi.fn(async () => ({ ok: true as const, data: undefined })) }
    } as unknown as Window['api']
    usePlaybackStore.setState({
      currentEpisode: makeEpisode(),
      currentPodcast: makePodcast(),
      isPlaying: false,
      currentTimeSec: 0,
      durationSec: 600,
      playbackError: null
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('names the play button for keyboard and assistive tech', () => {
    render(<MiniPlayer />)
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument()
  })
})
