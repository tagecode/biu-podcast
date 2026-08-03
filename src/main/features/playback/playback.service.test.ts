import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

process.env.BIU_PODCAST_DB_PATH = ':memory:'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/fake-userdata' }
}))

import { createTestDb, createTestSettings } from '../../test-utils/db'
import { PlaybackService } from './playback.service'
import { EpisodeRepository } from '../episode/episode.repository'
import * as schema from '../../infra/db/schema'

function seed(db: ReturnType<typeof createTestDb>['db']): number {
  const repo = new EpisodeRepository(db)
  db.insert(schema.podcasts)
    .values({
      id: 'pod-1',
      feedUrl: 'https://example.com/feed.xml',
      title: 'Test Podcast',
      description: null,
      coverUrl: null,
      author: 'Tester',
      language: 'en',
      isPaused: false,
      subscribedAt: 1700000000000,
      lastFetchedAt: 1700000000000,
      lastFetchStatus: 'ok'
    })
    .run()
  const inserted = repo.insertMany('pod-1', [
    {
      title: 'EP1',
      descriptionHtml: null,
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep1.mp3',
      durationSec: 600,
      fileSizeBytes: 1024,
      guid: 'guid-1'
    },
    {
      title: 'EP2',
      descriptionHtml: null,
      publishedAt: 1700001000000,
      audioUrl: 'https://example.com/ep2.mp3',
      durationSec: 300,
      fileSizeBytes: 512,
      guid: 'guid-2'
    }
  ])
  return inserted
}

describe('PlaybackService', () => {
  it('updateProgress persists position to db and settings', () => {
    const { db } = createTestDb()
    seed(db)
    const settings = createTestSettings()
    const service = new PlaybackService({ db, settings })

    const row = db.select().from(schema.episodes).where(eq(schema.episodes.title, 'EP1')).get()
    service.updateProgress(row!.id, 120)

    const after = db.select().from(schema.episodes).where(eq(schema.episodes.id, row!.id)).get()
    expect(after?.playbackPositionSec).toBe(120)
    expect(settings.getAll().lastEpisodeId).toBe(row!.id)
    expect(settings.getAll().lastPositionSec).toBe(120)
  })

  it('updateProgress throws NOT_FOUND for missing episode', () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new PlaybackService({ db, settings })
    expect(() => service.updateProgress('nope', 10)).toThrow('集数不存在')
  })

  it('getAdjacent returns previous (newer) and next (older) episodes', () => {
    const { db } = createTestDb()
    seed(db)
    const service = new PlaybackService({ db })

    // newest-first: EP2 is newest → for EP2 there is no previous; next = EP1
    const rows = db.select().from(schema.episodes).all()
    const ep2 = rows.find((e) => e.title === 'EP2')!
    const ep1 = rows.find((e) => e.title === 'EP1')!
    const adj = service.getAdjacent(ep2.id)
    expect(adj.previous).toBeNull()
    expect(adj.next?.id).toBe(ep1.id)

    const adj1 = service.getAdjacent(ep1.id)
    expect(adj1.previous?.id).toBe(ep2.id)
    expect(adj1.next).toBeNull()
  })

  it('getLastSession returns session with stored position', () => {
    const { db } = createTestDb()
    seed(db)
    const settings = createTestSettings()
    const service = new PlaybackService({ db, settings })
    const row = db.select().from(schema.episodes).where(eq(schema.episodes.title, 'EP1')).get()

    service.updateProgress(row!.id, 45)
    const session = service.getLastSession()
    expect(session?.episode.id).toBe(row!.id)
    expect(session?.positionSec).toBe(45)
    expect(session?.podcast.title).toBe('Test Podcast')
  })

  it('getLastSession returns null when no stored session', () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new PlaybackService({ db, settings })
    expect(service.getLastSession()).toBeNull()
  })
})
