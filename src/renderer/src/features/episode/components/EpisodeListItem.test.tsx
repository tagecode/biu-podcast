import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Episode } from '@shared/types'
import { EpisodeListItem } from './EpisodeListItem'

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-1',
    podcastId: 'pod-1',
    title: 'AI 周报',
    descriptionHtml: null,
    publishedAt: 1700000000000,
    audioUrl: 'https://example.com/ep.mp3',
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

function rowOf(title: string): HTMLElement {
  const titleEl = screen.getByText(title)
  const row = titleEl.closest('[class*="rounded-md"]')
  if (!(row instanceof HTMLElement)) {
    throw new Error(`row not found for ${title}`)
  }
  return row
}

describe('EpisodeListItem selection', () => {
  afterEach(() => {
    cleanup()
  })

  it('highlights the episode whose detail is open', () => {
    render(<EpisodeListItem episode={makeEpisode()} selected onPlay={vi.fn()} />)
    expect(rowOf('AI 周报')).toHaveClass('bg-amber-100')
  })

  it('does not highlight a playing episode that is not selected', () => {
    render(<EpisodeListItem episode={makeEpisode()} isCurrentPlaying onPlay={vi.fn()} />)
    expect(rowOf('AI 周报')).not.toHaveClass('bg-amber-100')
  })
})
