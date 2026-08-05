import { describe, expect, it, vi } from 'vitest'

process.env.BIU_PODCAST_DB_PATH = ':memory:'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/fake-userdata' }
}))

import { createTestDb } from '../../test-utils/db'
import { EpisodeService } from './episode.service'
import { EpisodeRepository } from './episode.repository'
import * as schema from '../../infra/db/schema'
import { eq } from 'drizzle-orm'

function seedOne(db: ReturnType<typeof createTestDb>['db']): string {
  const repo = new EpisodeRepository(db)
  db.insert(schema.podcasts)
    .values({
      id: 'pod-1',
      feedUrl: 'https://example.com/feed.xml',
      title: 'Test',
      description: null,
      coverUrl: null,
      author: null,
      language: null,
      isPaused: false,
      subscribedAt: 1700000000000,
      lastFetchedAt: 1700000000000,
      lastFetchStatus: 'ok'
    })
    .run()
  repo.insertMany('pod-1', [
    {
      title: 'EP1',
      descriptionHtml: '<p>hello</p>',
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep1.mp3',
      durationSec: 600,
      fileSizeBytes: 1024,
      guid: 'guid-1'
    },
    {
      title: 'EP2',
      descriptionHtml: '<p>second</p>',
      publishedAt: 1700001000000,
      audioUrl: 'https://example.com/ep2.mp3',
      durationSec: 300,
      fileSizeBytes: 512,
      guid: 'guid-2'
    }
  ])
  return 'pod-1'
}

describe('EpisodeService', () => {
  it('listByPodcast returns episodes with unread count and pagination', () => {
    const { db } = createTestDb()
    seedOne(db)
    const service = new EpisodeService({ db })

    const page = service.listByPodcast('pod-1', 0, 50)
    expect(page.total).toBe(2)
    expect(page.unreadCount).toBe(2)
    expect(page.hasMore).toBe(false)
    expect(page.items).toHaveLength(2)
  })

  it('getById returns sanitized rich html', () => {
    const { db } = createTestDb()
    seedOne(db)
    const service = new EpisodeService({ db })

    const listed = service.listByPodcast('pod-1', 0, 1)
    const detail = service.getById(listed.items[0]!.id)
    expect(detail.title).toBeTruthy()
    expect(detail.id).toBe(listed.items[0]!.id)
  })

  it('getById throws NOT_FOUND for missing episode', () => {
    const { db } = createTestDb()
    const service = new EpisodeService({ db })
    expect(() => service.getById('nope')).toThrow('集数不存在')
  })

  it('markAllPlayed updates all unplayed episodes', () => {
    const { db } = createTestDb()
    seedOne(db)
    const service = new EpisodeService({ db })

    const changed = service.markAllPlayed('pod-1')
    expect(changed).toBe(2)
    const after = db.select().from(schema.episodes).all()
    expect(after.every((e) => e.isPlayed)).toBe(true)
  })

  it('markPlayed marks a single episode played and is idempotent', () => {
    const { db } = createTestDb()
    seedOne(db)
    const service = new EpisodeService({ db })

    const episodeId = db.select().from(schema.episodes).get()!.id
    const first = service.markPlayedWithPodcast(episodeId)
    expect(first.changed).toBe(true)
    expect(first.podcastId).toBe('pod-1')

    const row = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).get()
    expect(row?.isPlayed).toBe(true)

    // Second call changes nothing (already played).
    const second = service.markPlayedWithPodcast(episodeId)
    expect(second.changed).toBe(false)
  })

  it('markPlayed throws NOT_FOUND for missing episode', () => {
    const { db } = createTestDb()
    const service = new EpisodeService({ db })
    expect(() => service.markPlayed('nope')).toThrow('集数不存在')
  })

  it('updateProgress throws NOT_FOUND for missing episode', () => {
    const { db } = createTestDb()
    const service = new EpisodeService({ db })
    expect(() => service.updateProgress('nope', 10)).toThrow('集数不存在')
  })

  it('getLatest returns newest episode', () => {
    const { db } = createTestDb()
    seedOne(db)
    const service = new EpisodeService({ db })
    const latest = service.getLatest('pod-1')
    expect(latest?.title).toBe('EP2')
  })
})
