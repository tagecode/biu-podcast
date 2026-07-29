import { describe, expect, it } from 'vitest'
import type { Episode } from '@shared/types'

import { resolveMediaUrl } from './media-url'

describe('resolveMediaUrl', () => {
  const base: Episode = {
    id: 'ep1',
    podcastId: 'pod1',
    title: 'Test',
    descriptionHtml: null,
    publishedAt: 0,
    audioUrl: 'https://cdn.example.com/a.mp3',
    durationSec: 60,
    fileSizeBytes: 1000,
    isPlayed: false,
    playbackPositionSec: 0,
    isDownloaded: false,
    localFilePath: null,
    downloadStatus: null,
    downloadedAt: null
  }

  it('uses remote url when not downloaded', () => {
    expect(resolveMediaUrl(base)).toBe(base.audioUrl)
  })

  it('uses biu-media protocol when downloaded', () => {
    const episode = {
      ...base,
      isDownloaded: true,
      localFilePath: 'C:\\data\\ep1.mp3'
    }
    expect(resolveMediaUrl(episode)).toBe(
      `biu-media://local/?path=${encodeURIComponent('C:\\data\\ep1.mp3')}`
    )
  })
})
