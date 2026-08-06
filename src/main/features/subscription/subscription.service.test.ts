import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.BIU_PODCAST_DB_PATH = ':memory:'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/fake-userdata' }
}))

import { createMemoryDb } from '../../infra/db/client'
import { SettingsStore } from '../../infra/settings/store'
import { SubscriptionService } from './subscription.service'
import { AppError } from '@shared/errors'

const TMP = mkdtempSync(join(tmpdir(), 'biu-svc-'))

vi.mock('./feed-parser', () => ({
  fetchAndParseFeed: vi.fn()
}))

import { fetchAndParseFeed } from './feed-parser'
import * as schema from '../../infra/db/schema'
import { eq } from 'drizzle-orm'
import type { ParsedFeed } from '@shared/types'

const mockFetch = fetchAndParseFeed as ReturnType<typeof vi.fn>

function makeFeed(overrides: Partial<ParsedFeed> = {}): ParsedFeed {
  return {
    title: 'Test Podcast',
    description: 'A test feed',
    coverUrl: null,
    author: 'Tester',
    language: 'en',
    episodes: [
      {
        title: 'EP1',
        descriptionHtml: '<p>hello</p>',
        publishedAt: 1700000000000,
        audioUrl: 'https://example.com/ep1.mp3',
        durationSec: 600,
        fileSizeBytes: 1024,
        guid: 'guid-1'
      }
    ],
    ...overrides
  }
}

function setup(): {
  db: ReturnType<typeof createMemoryDb>['db']
  sqlite: ReturnType<typeof createMemoryDb>['sqlite']
  settings: SettingsStore
} {
  const { db, sqlite } = createMemoryDb()
  sqlite.exec(`
    CREATE TABLE podcasts (
      id text PRIMARY KEY NOT NULL,
      feed_url text NOT NULL UNIQUE,
      title text NOT NULL,
      description text,
      cover_url text,
      author text,
      language text,
      is_paused integer DEFAULT false NOT NULL,
      unsubscribed_at integer,
      subscribed_at integer NOT NULL,
      last_fetched_at integer,
      last_fetch_status text
    );
    CREATE TABLE episodes (
      id text PRIMARY KEY NOT NULL,
      podcast_id text NOT NULL,
      guid text,
      title text NOT NULL,
      description_html text,
      published_at integer NOT NULL,
      audio_url text NOT NULL,
      duration_sec integer,
      file_size_bytes integer,
      is_played integer DEFAULT false NOT NULL,
      playback_position_sec real DEFAULT 0 NOT NULL,
      is_downloaded integer DEFAULT false NOT NULL,
      local_file_path text,
      download_status text,
      downloaded_at integer,
      FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE cascade
    );
    CREATE TABLE download_tasks (
      id text PRIMARY KEY NOT NULL,
      episode_id text NOT NULL,
      status text NOT NULL,
      progress_bytes integer DEFAULT 0 NOT NULL,
      total_bytes integer,
      retry_count integer DEFAULT 0 NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE cascade
    );
  `)
  return { db, sqlite, settings: new SettingsStore({ cwd: TMP }) }
}

describe('SubscriptionService', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('add: inserts podcast + episodes when feed parses', async () => {
    const { db, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })

    const podcast = await service.add('https://example.com/feed.xml')

    expect(podcast.title).toBe('Test Podcast')
    expect(podcast.feedUrl).toContain('example.com/feed.xml')
    expect(podcast.unreadCount).toBe(1)

    const rows = db.select().from(schema.podcasts).all()
    expect(rows).toHaveLength(1)
    expect(db.select().from(schema.episodes).all()).toHaveLength(1)
  })

  it('add: throws ALREADY_SUBSCRIBED when feedUrl already exists', async () => {
    const { db, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    await service.add('https://example.com/feed.xml')

    await expect(service.add('https://example.com/feed.xml')).rejects.toThrow('已订阅')
  })

  it('list: returns podcasts with unread count', async () => {
    const { db, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    await service.add('https://example.com/feed.xml')

    const list = service.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.unreadCount).toBe(1)
  })

  it('refresh: adds new episodes and updates metadata', async () => {
    const { db, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    const podcast = await service.add('https://example.com/feed.xml')

    // Second refresh returns a new episode
    mockFetch.mockResolvedValueOnce(
      makeFeed({
        title: 'Renamed Podcast',
        episodes: [
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
            descriptionHtml: null,
            publishedAt: 1700001000000,
            audioUrl: 'https://example.com/ep2.mp3',
            durationSec: 300,
            fileSizeBytes: 512,
            guid: 'guid-2'
          }
        ]
      })
    )

    const result = await service.refresh(podcast.id)
    expect(result.addedCount).toBe(1)
    expect(result.podcast.title).toBe('Renamed Podcast')
    expect(db.select().from(schema.episodes).all()).toHaveLength(2)
  })

  it('refresh: on failure keeps data and records failure status', async () => {
    const { db, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    const podcast = await service.add('https://example.com/feed.xml')

    mockFetch.mockRejectedValue(new AppError('TIMEOUT', '请求超时'))
    await expect(service.refresh(podcast.id)).rejects.toThrow('请求超时')

    // data preserved
    expect(db.select().from(schema.episodes).all()).toHaveLength(1)
    const row = db.select().from(schema.podcasts).where(eq(schema.podcasts.id, podcast.id)).get()
    expect(row?.lastFetchStatus).toBe('timeout')
  })

  it('remove: deleteData=true cascades and cleans files', async () => {
    const { db, sqlite, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    const podcast = await service.add('https://example.com/feed.xml')

    // set a local file path on the episode so remove cleans it up
    db.update(schema.episodes).set({ isDownloaded: true, localFilePath: '/tmp/ep1.mp3' }).run()

    await service.remove(podcast.id, true)
    expect(db.select().from(schema.podcasts).all()).toHaveLength(0)
    expect(db.select().from(schema.episodes).all()).toHaveLength(0)
    sqlite.close()
  })

  it('remove: deleteData=false soft-unsubscribes (keeps data)', async () => {
    const { db, sqlite, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    const podcast = await service.add('https://example.com/feed.xml')

    await service.remove(podcast.id, false)
    const rows = db.select().from(schema.podcasts).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.unsubscribedAt).not.toBeNull()
    // episodes retained
    expect(db.select().from(schema.episodes).all()).toHaveLength(1)
    sqlite.close()
  })

  it('remove: throws NOT_FOUND for missing podcast', async () => {
    const { db, settings } = setup()
    const service = new SubscriptionService({ db, settings })
    await expect(service.remove('nope', true)).rejects.toThrow('播客不存在')
  })

  it('add: re-activates a soft-unsubscribed podcast instead of UNIQUE conflict', async () => {
    const { db, sqlite, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })

    // Subscribe, then soft-unsubscribe (keep data).
    const podcast = await service.add('https://example.com/feed.xml')
    await service.remove(podcast.id, false)

    // Re-subscribe with the same feed URL.
    mockFetch.mockResolvedValueOnce(makeFeed({ title: 'Re-activated' }))
    const reactivated = await service.add('https://example.com/feed.xml')

    // Same record, re-activated; feed_url UNIQUE was not violated.
    expect(reactivated.id).toBe(podcast.id)
    expect(reactivated.title).toBe('Re-activated')
    const rows = db.select().from(schema.podcasts).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.unsubscribedAt).toBeNull()
    // Episodes kept and merged without duplicates.
    expect(db.select().from(schema.episodes).all()).toHaveLength(1)
    sqlite.close()
  })

  it('setPaused: toggles isPaused', async () => {
    const { db, sqlite, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })
    const podcast = await service.add('https://example.com/feed.xml')

    service.setPaused(podcast.id, true)
    let row = db.select().from(schema.podcasts).where(eq(schema.podcasts.id, podcast.id)).get()
    expect(row?.isPaused).toBe(true)

    service.setPaused(podcast.id, false)
    row = db.select().from(schema.podcasts).where(eq(schema.podcasts.id, podcast.id)).get()
    expect(row?.isPaused).toBe(false)
    sqlite.close()
  })

  it('setPaused: throws NOT_FOUND for missing podcast', () => {
    const { db, settings } = setup()
    const service = new SubscriptionService({ db, settings })
    expect(() => service.setPaused('nope', true)).toThrow('播客不存在')
  })

  it('refreshAll: refreshes active podcasts and skips paused', async () => {
    const { db, sqlite, settings } = setup()
    mockFetch.mockResolvedValue(makeFeed())
    const service = new SubscriptionService({ db, settings })

    const p1 = await service.add('https://example.com/one.xml')
    const p2 = await service.add('https://example.com/two.xml')
    // Pause p2 — it must not be refreshed.
    service.setPaused(p2.id, true)

    // Second call: p1 gets one new episode, p2 skipped.
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce(
      makeFeed({
        episodes: [
          makeFeed().episodes[0]!,
          {
            title: 'EP-NEW',
            descriptionHtml: null,
            publishedAt: 1700002000000,
            audioUrl: 'https://example.com/new.mp3',
            durationSec: 300,
            fileSizeBytes: 512,
            guid: 'guid-new'
          }
        ]
      })
    )

    const results = await service.refreshAll()
    const p1Result = results.find((r) => r.podcastId === p1.id)
    expect(p1Result?.addedCount).toBe(1)
    // p2 was paused → refreshAll should not have produced a result for it.
    expect(results.find((r) => r.podcastId === p2.id)).toBeUndefined()
    sqlite.close()
  })
})
