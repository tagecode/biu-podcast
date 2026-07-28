import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { describe, expect, it } from 'vitest'

import * as schema from '../../infra/db/schema'
import { EpisodeRepository } from './episode.repository'
import type { ParsedFeedEpisode } from '@shared/types'

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
