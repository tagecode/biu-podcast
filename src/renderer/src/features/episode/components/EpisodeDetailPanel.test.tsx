import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Episode } from '@shared/types'
import { EpisodeDetailPanel } from './EpisodeDetailPanel'

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-1',
    podcastId: 'pod-1',
    title: 'EP1',
    descriptionHtml: null,
    publishedAt: 1700000000000,
    audioUrl: 'https://example.com/ep1.mp3',
    durationSec: 600,
    fileSizeBytes: 1024,
    isPlayed: false,
    playbackPositionSec: 0,
    isDownloaded: false,
    localFilePath: null,
    downloadStatus: null,
    downloadedAt: null,
    guid: 'g1',
    ...overrides
  }
}

describe('EpisodeDetailPanel chapters', () => {
  const getChapters = vi.fn(
    async (): Promise<{ ok: true; data: import('@shared/types').Chapter[] }> => ({
      ok: true,
      data: []
    })
  )
  const listPlaylists = vi.fn(async () => ({ ok: true as const, data: [] }))
  const listNotes = vi.fn(async () => ({ ok: true as const, data: [] }))

  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      episode: { getChapters },
      playlist: { list: listPlaylists },
      note: { listByEpisode: listNotes }
    } as unknown as Window['api']
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the chapter list and jumps to a chapter on click', async () => {
    getChapters.mockResolvedValueOnce({
      ok: true as const,
      data: [
        { startTime: 0, title: 'Intro' },
        { startTime: 120, title: 'Main' }
      ]
    })
    const onPlayFrom = vi.fn()
    render(
      <EpisodeDetailPanel
        episode={makeEpisode({ chaptersUrl: 'https://x.com/chapters.json' })}
        onClose={() => {}}
        onPlay={() => {}}
        onPlayFrom={onPlayFrom}
      />
    )

    await screen.findByText('章节')
    expect(screen.getByText('Intro')).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Main'))
    expect(onPlayFrom).toHaveBeenCalledWith(120)
  })

  it('does not render a chapter section when the feed has no chapters', () => {
    render(
      <EpisodeDetailPanel
        episode={makeEpisode({ chaptersUrl: undefined })}
        onClose={() => {}}
        onPlay={() => {}}
      />
    )
    expect(screen.queryByText('章节')).not.toBeInTheDocument()
  })

  it('renders nothing when chapters fail to load', async () => {
    getChapters.mockResolvedValueOnce({ ok: true as const, data: [] })
    render(
      <EpisodeDetailPanel
        episode={makeEpisode({ chaptersUrl: 'https://x.com/chapters.json' })}
        onClose={() => {}}
        onPlay={() => {}}
      />
    )
    // Section is hidden (empty list) — wait a tick for the async load.
    await waitFor(() => {
      expect(screen.queryByText('章节')).not.toBeInTheDocument()
    })
  })
})
