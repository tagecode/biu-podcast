import { describe, expect, it } from 'vitest'

import { previewImport } from './preview'

describe('previewImport', () => {
  it('counts all items as added when local is empty', () => {
    const preview = previewImport(
      {
        podcasts: [{ id: 'p1' }, { id: 'p2' }],
        episodes: [{ id: 'e1' }],
        downloadTasks: [{ id: 'd1' }]
      },
      {
        podcastIds: new Set(),
        episodeIds: new Set(),
        downloadTaskIds: new Set()
      }
    )
    expect(preview).toEqual({
      podcastsAdded: 2,
      podcastsConflict: 0,
      episodesAdded: 1,
      episodesConflict: 0,
      downloadTasksAdded: 1,
      downloadTasksConflict: 0
    })
  })

  it('counts conflicts when ids already exist', () => {
    const preview = previewImport(
      {
        podcasts: [{ id: 'p1' }, { id: 'p2' }],
        episodes: [{ id: 'e1' }, { id: 'e2' }],
        downloadTasks: [{ id: 'd1' }]
      },
      {
        podcastIds: new Set(['p1']),
        episodeIds: new Set(['e1']),
        downloadTaskIds: new Set(['d1'])
      }
    )
    expect(preview).toEqual({
      podcastsAdded: 1,
      podcastsConflict: 1,
      episodesAdded: 1,
      episodesConflict: 1,
      downloadTasksAdded: 0,
      downloadTasksConflict: 1
    })
  })
})
