import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { describe, expect, it } from 'vitest'

import * as schema from '../../infra/db/schema'
import { createTestDb } from '../../test-utils/db'
import { EpisodeRepository } from './episode.repository'
import type { ParsedFeedEpisode } from '@shared/types'

function insertPodcast(
  db: ReturnType<typeof createTestDb>['db'],
  id: string,
  title: string,
  unsubscribedAt: number | null = null
): void {
  db.insert(schema.podcasts)
    .values({
      id,
      feedUrl: `https://example.com/${id}.xml`,
      title,
      description: null,
      coverUrl: null,
      author: null,
      language: null,
      isPaused: false,
      unsubscribedAt,
      subscribedAt: 1700000000000,
      lastFetchedAt: 1700000000000,
      lastFetchStatus: 'ok'
    })
    .run()
}

function makeEpisodes(count: number): ParsedFeedEpisode[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `EP.${index}`,
    descriptionHtml: `<p>${'x'.repeat(100)}</p>`,
    publishedAt: Date.now() - index * 1000,
    audioUrl: `https://example.com/audio/${index}.mp3`,
    durationSec: 600,
    fileSizeBytes: 1024,
    guid: `guid-${index}`
  }))
}

describe('EpisodeRepository.insertMany', () => {
  it('bulk inserts a large feed without O(n^2) lookups', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
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
        chapters_url text,
        link text,
        FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE cascade
      );
    `)

    const db = drizzle(sqlite, { schema })
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
        subscribedAt: Date.now(),
        lastFetchedAt: Date.now(),
        lastFetchStatus: 'ok'
      })
      .run()

    const repo = new EpisodeRepository(db)
    const started = Date.now()
    const inserted = repo.insertMany('pod-1', makeEpisodes(1200))
    const elapsed = Date.now() - started

    expect(inserted).toBe(1200)
    expect(elapsed).toBeLessThan(5000)

    const page = repo.listByPodcastPage('pod-1', 0, 50)
    expect(page.total).toBe(1200)
    expect(page.items).toHaveLength(50)
    expect(page.hasMore).toBe(true)
    expect(page.items[0]?.descriptionHtml).toBeNull()

    const again = repo.insertMany('pod-1', makeEpisodes(1200))
    expect(again).toBe(0)

    sqlite.close()
  })
})

describe('EpisodeRepository.insertMany backfill', () => {
  it('fills empty link and chaptersUrl on existing episodes without touching playback state', () => {
    const { db, sqlite } = createTestDb()
    insertPodcast(db, 'pod-a', 'Tech')
    const repo = new EpisodeRepository(db)

    repo.insertMany('pod-a', [
      {
        title: 'Old',
        descriptionHtml: null,
        publishedAt: 1_700_000_000_000,
        audioUrl: 'https://cdn.example/a.mp3',
        durationSec: 60,
        fileSizeBytes: 1,
        guid: 'guid-a',
        link: null,
        chaptersUrl: null
      }
    ])

    sqlite
      .prepare(
        `UPDATE episodes SET is_played = 1, playback_position_sec = 12.5 WHERE guid = 'guid-a'`
      )
      .run()

    const added = repo.insertMany('pod-a', [
      {
        title: 'Old renamed in feed (must not apply)',
        descriptionHtml: '<p>x</p>',
        publishedAt: 1_700_000_000_000,
        audioUrl: 'https://cdn.example/a.mp3',
        durationSec: 60,
        fileSizeBytes: 1,
        guid: 'guid-a',
        link: 'https://show.example/ep/a',
        chaptersUrl: 'https://show.example/a/chapters.json'
      }
    ])

    expect(added).toBe(0)
    const row = sqlite.prepare(`SELECT * FROM episodes WHERE guid = 'guid-a'`).get() as {
      title: string
      link: string | null
      chapters_url: string | null
      is_played: number
      playback_position_sec: number
    }
    expect(row.link).toBe('https://show.example/ep/a')
    expect(row.chapters_url).toBe('https://show.example/a/chapters.json')
    expect(row.is_played).toBe(1)
    expect(row.playback_position_sec).toBe(12.5)
    expect(row.title).toBe('Old')
    sqlite.close()
  })

  it('does not overwrite a non-empty link', () => {
    const { db, sqlite } = createTestDb()
    insertPodcast(db, 'pod-a', 'Tech')
    const repo = new EpisodeRepository(db)
    repo.insertMany('pod-a', [
      {
        title: 'Ep',
        descriptionHtml: null,
        publishedAt: 1,
        audioUrl: 'https://cdn.example/b.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'guid-b',
        link: 'https://original.example/b',
        chaptersUrl: null
      }
    ])
    repo.insertMany('pod-a', [
      {
        title: 'Ep',
        descriptionHtml: null,
        publishedAt: 1,
        audioUrl: 'https://cdn.example/b.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'guid-b',
        link: 'https://new.example/b',
        chaptersUrl: null
      }
    ])
    const row = sqlite.prepare(`SELECT link FROM episodes WHERE guid = 'guid-b'`).get() as {
      link: string
    }
    expect(row.link).toBe('https://original.example/b')
    sqlite.close()
  })
})

describe('EpisodeRepository.search', () => {
  it('matches title and description across subscribed podcasts', () => {
    const { db } = createTestDb()
    insertPodcast(db, 'pod-a', '科技早知道')
    insertPodcast(db, 'pod-b', '故事 FM')
    const repo = new EpisodeRepository(db)
    repo.insertMany('pod-a', [
      {
        title: 'AI 周报',
        descriptionHtml: '<p>大模型进展</p>',
        publishedAt: 1700002000000,
        audioUrl: 'https://example.com/a1.mp3',
        durationSec: 600,
        fileSizeBytes: 1024,
        guid: 'a1'
      },
      {
        title: '硬件评测',
        descriptionHtml: '<p>无关内容</p>',
        publishedAt: 1700001000000,
        audioUrl: 'https://example.com/a2.mp3',
        durationSec: 300,
        fileSizeBytes: 512,
        guid: 'a2'
      }
    ])
    repo.insertMany('pod-b', [
      {
        title: '口述历史',
        descriptionHtml: '<p>关于 AI 伦理的访谈</p>',
        publishedAt: 1700003000000,
        audioUrl: 'https://example.com/b1.mp3',
        durationSec: 900,
        fileSizeBytes: 2048,
        guid: 'b1'
      }
    ])

    const hits = repo.search('AI')
    expect(hits.map((h) => h.episode.title)).toEqual(['口述历史', 'AI 周报'])
    expect(hits[0]?.podcastTitle).toBe('故事 FM')
    expect(hits[1]?.podcastTitle).toBe('科技早知道')
    expect(hits.every((h) => h.episode.descriptionHtml === null)).toBe(true)
  })

  it('skips episodes from unsubscribed podcasts', () => {
    const { db } = createTestDb()
    insertPodcast(db, 'pod-a', 'Active')
    insertPodcast(db, 'pod-b', 'Gone', Date.now())
    const repo = new EpisodeRepository(db)
    repo.insertMany('pod-a', [
      {
        title: 'Keep me',
        descriptionHtml: null,
        publishedAt: 1,
        audioUrl: 'https://example.com/keep.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'keep'
      }
    ])
    repo.insertMany('pod-b', [
      {
        title: 'Keep me too',
        descriptionHtml: null,
        publishedAt: 2,
        audioUrl: 'https://example.com/gone.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'gone'
      }
    ])

    const hits = repo.search('Keep')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.episode.title).toBe('Keep me')
  })

  it('filters to downloaded episodes when requested', () => {
    const { db } = createTestDb()
    insertPodcast(db, 'pod-a', 'Pod')
    const repo = new EpisodeRepository(db)
    repo.insertMany('pod-a', [
      {
        title: 'Offline talk',
        descriptionHtml: null,
        publishedAt: 2,
        audioUrl: 'https://example.com/off.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'off'
      },
      {
        title: 'Online talk',
        descriptionHtml: null,
        publishedAt: 1,
        audioUrl: 'https://example.com/on.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'on'
      }
    ])
    const downloaded = repo
      .listByPodcastPage('pod-a', 0, 10)
      .items.find((e) => e.title === 'Offline talk')
    expect(downloaded).toBeTruthy()
    repo.markDownloaded(downloaded!.id, '/tmp/off.mp3')

    const hits = repo.search('talk', { downloadedOnly: true })
    expect(hits).toHaveLength(1)
    expect(hits[0]?.episode.title).toBe('Offline talk')
    expect(hits[0]?.episode.isDownloaded).toBe(true)
  })

  it('returns an empty list for blank queries and treats % as a literal', () => {
    const { db } = createTestDb()
    insertPodcast(db, 'pod-a', 'Pod')
    const repo = new EpisodeRepository(db)
    repo.insertMany('pod-a', [
      {
        title: 'Anything',
        descriptionHtml: null,
        publishedAt: 1,
        audioUrl: 'https://example.com/any.mp3',
        durationSec: 1,
        fileSizeBytes: 1,
        guid: 'any'
      }
    ])

    expect(repo.search('   ')).toEqual([])
    expect(repo.search('%')).toEqual([])
  })

  it('honors the result limit', () => {
    const { db } = createTestDb()
    insertPodcast(db, 'pod-a', 'Pod')
    const repo = new EpisodeRepository(db)
    repo.insertMany(
      'pod-a',
      Array.from({ length: 5 }, (_, i) => ({
        title: `Topic ${i}`,
        descriptionHtml: null,
        publishedAt: i,
        audioUrl: `https://example.com/${i}.mp3`,
        durationSec: 1,
        fileSizeBytes: 1,
        guid: `g-${i}`
      }))
    )

    expect(repo.search('Topic', { limit: 2 })).toHaveLength(2)
  })
})
