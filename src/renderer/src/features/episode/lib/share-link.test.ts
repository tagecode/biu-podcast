import { describe, expect, it } from 'vitest'
import type { Episode, Podcast } from '@shared/types'

import { episodeShareUrl, podcastShareUrl } from './share-link'

describe('share links', () => {
  it('uses the podcast feed URL for podcasts', () => {
    expect(podcastShareUrl({ feedUrl: 'https://example.com/feed.xml' } as Podcast)).toBe(
      'https://example.com/feed.xml'
    )
  })

  it('prefers the episode permalink and falls back to audio URL', () => {
    expect(
      episodeShareUrl({
        link: 'https://example.com/ep1',
        audioUrl: 'https://cdn.example.com/1.mp3'
      } as Episode)
    ).toBe('https://example.com/ep1')
    expect(
      episodeShareUrl({
        link: null,
        guid: 'https://example.com/ep1',
        audioUrl: 'https://cdn.example.com/1.mp3'
      } as Episode)
    ).toBe('https://example.com/ep1')
    expect(
      episodeShareUrl({
        link: null,
        guid: 'tag:example.com,1',
        audioUrl: 'https://cdn.example.com/1.mp3'
      } as Episode)
    ).toBe('https://cdn.example.com/1.mp3')
  })
})
