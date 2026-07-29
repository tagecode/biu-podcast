import { describe, expect, it } from 'vitest'

import { findAdjacentEpisodes } from './adjacent-episode'
import type { Episode } from '@shared/types'

function ep(id: string, publishedAt: number): Episode {
  return {
    id,
    podcastId: 'p1',
    title: id,
    descriptionHtml: null,
    publishedAt,
    audioUrl: `https://example.com/${id}.mp3`,
    durationSec: 60,
    fileSizeBytes: 1,
    isPlayed: false,
    playbackPositionSec: 0,
    isDownloaded: false,
    localFilePath: null,
    downloadStatus: null,
    downloadedAt: null
  }
}

describe('findAdjacentEpisodes', () => {
  const list = [ep('newest', 300), ep('mid', 200), ep('oldest', 100)]

  it('disables previous on newest and next on oldest', () => {
    expect(findAdjacentEpisodes(list, 'newest')).toEqual({
      previous: null,
      next: list[1]
    })
    expect(findAdjacentEpisodes(list, 'oldest')).toEqual({
      previous: list[1],
      next: null
    })
  })

  it('returns both neighbors for middle episode', () => {
    expect(findAdjacentEpisodes(list, 'mid')).toEqual({
      previous: list[0],
      next: list[2]
    })
  })
})
