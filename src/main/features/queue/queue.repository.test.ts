import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { createMemoryDb } from '../../infra/db/client'
import { episodes, podcasts } from '../../infra/db/schema'
import { QueueRepository } from './queue.repository'

function setup(): {
  db: ReturnType<typeof createMemoryDb>['db']
  sqlite: ReturnType<typeof createMemoryDb>['sqlite']
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
      chapters_url text,
      link text,
      FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE cascade
    );
    CREATE TABLE playback_queue (
      id text PRIMARY KEY NOT NULL,
      episode_ids text NOT NULL,
      mode text NOT NULL,
      current_episode_id text,
      updated_at integer NOT NULL
    );
  `)
  return { db, sqlite }
}

function seedEpisodes(db: ReturnType<typeof createMemoryDb>['db'], count: number): string[] {
  db.insert(podcasts)
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
  const ids: string[] = []
  for (let i = 1; i <= count; i++) {
    const id = `ep-${i}`
    ids.push(id)
    db.insert(episodes)
      .values({
        id,
        podcastId: 'pod-1',
        guid: `g${i}`,
        title: `EP${i}`,
        descriptionHtml: null,
        publishedAt: 1700000000000,
        audioUrl: `https://example.com/ep${i}.mp3`,
        durationSec: 600,
        fileSizeBytes: 1024,
        isPlayed: false,
        playbackPositionSec: 0,
        isDownloaded: false
      })
      .run()
  }
  return ids
}

describe('QueueRepository', () => {
  it('saves then loads a queue with mode and current episode', () => {
    const { db, sqlite } = setup()
    const ids = seedEpisodes(db, 3)
    const repo = new QueueRepository(db)

    repo.save({ episodeIds: ids, mode: 'shuffle', currentEpisodeId: ids[1] })
    const loaded = repo.load()
    expect(loaded).toEqual({ episodeIds: ids, mode: 'shuffle', currentEpisodeId: ids[1] })
    sqlite.close()
  })

  it('overwrites on a second save', () => {
    const { db, sqlite } = setup()
    const ids = seedEpisodes(db, 3)
    const repo = new QueueRepository(db)

    repo.save({ episodeIds: ids, mode: 'list', currentEpisodeId: ids[0] })
    repo.save({ episodeIds: [ids[2]], mode: 'repeat-one', currentEpisodeId: ids[2] })
    const loaded = repo.load()
    expect(loaded).toEqual({
      episodeIds: [ids[2]],
      mode: 'repeat-one',
      currentEpisodeId: ids[2]
    })
    sqlite.close()
  })

  it('prunes episode ids that no longer exist and invalid current', () => {
    const { db, sqlite } = setup()
    const ids = seedEpisodes(db, 3)
    const repo = new QueueRepository(db)

    // ep-2 deleted; current points at a deleted id.
    db.delete(episodes).where(eq(episodes.id, ids[1]!)).run()
    repo.save({
      episodeIds: [ids[0], 'deleted-ep', ids[2]],
      mode: 'list',
      currentEpisodeId: 'deleted-ep'
    })
    const loaded = repo.load()
    expect(loaded).toEqual({
      episodeIds: [ids[0], ids[2]],
      mode: 'list',
      currentEpisodeId: null
    })
    sqlite.close()
  })

  it('clear removes the queue row', () => {
    const { db, sqlite } = setup()
    const ids = seedEpisodes(db, 2)
    const repo = new QueueRepository(db)

    repo.save({ episodeIds: ids, mode: 'list', currentEpisodeId: ids[0] })
    repo.clear()
    expect(repo.load()).toBeNull()
    sqlite.close()
  })

  it('returns null when no queue was ever saved', () => {
    const { db, sqlite } = setup()
    const repo = new QueueRepository(db)
    expect(repo.load()).toBeNull()
    sqlite.close()
  })
})
