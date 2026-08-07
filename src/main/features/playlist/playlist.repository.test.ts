import { describe, expect, it } from 'vitest'

import { createMemoryDb } from '../../infra/db/client'
import { PlaylistRepository } from './playlist.repository'
import { NoteRepository } from './note.repository'
import { episodes, podcasts } from '../../infra/db/schema'

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
      FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE cascade
    );
    CREATE TABLE playlists (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      created_at integer NOT NULL
    );
    CREATE TABLE playlist_items (
      id text PRIMARY KEY NOT NULL,
      playlist_id text NOT NULL,
      episode_id text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      added_at integer NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE cascade,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE cascade
    );
    CREATE TABLE notes (
      id text PRIMARY KEY NOT NULL,
      episode_id text NOT NULL,
      timestamp_sec integer NOT NULL,
      content text NOT NULL,
      created_at integer NOT NULL,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE cascade
    );
  `)
  return { db, sqlite }
}

function seedPodcastWithEpisode(db: ReturnType<typeof createMemoryDb>['db']): {
  podcastId: string
  episodeId: string
} {
  const podcastId = 'pod-1'
  db.insert(podcasts)
    .values({
      id: podcastId,
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
  const episodeId = 'ep-1'
  db.insert(episodes)
    .values({
      id: episodeId,
      podcastId,
      guid: 'g1',
      title: 'EP1',
      descriptionHtml: null,
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep1.mp3',
      durationSec: 600,
      fileSizeBytes: 1024,
      isPlayed: false,
      playbackPositionSec: 0,
      isDownloaded: false
    })
    .run()
  return { podcastId, episodeId }
}

describe('PlaylistRepository', () => {
  it('creates, lists, renames, and deletes playlists', () => {
    const { db, sqlite } = setup()
    const repo = new PlaylistRepository(db)

    const pl = repo.create('通勤')
    expect(pl.name).toBe('通勤')
    expect(repo.list()).toHaveLength(1)
    expect(repo.list()[0]?.itemCount).toBe(0)

    repo.rename(pl.id, '上下班')
    expect(repo.findById(pl.id)?.name).toBe('上下班')

    repo.delete(pl.id)
    expect(repo.list()).toHaveLength(0)
    sqlite.close()
  })

  it('adds/removes items and tracks sort order', () => {
    const { db, sqlite } = setup()
    seedPodcastWithEpisode(db)
    const repo = new PlaylistRepository(db)
    const pl = repo.create('列表')

    repo.addItem(pl.id, 'ep-1')
    repo.addItem(pl.id, 'ep-1') // re-add is a no-op
    const items = repo.listItems(pl.id)
    expect(items).toHaveLength(1)
    expect(items[0]?.episodeTitle).toBe('EP1')
    expect(repo.list()[0]?.itemCount).toBe(1)

    repo.removeItem(pl.id, 'ep-1')
    expect(repo.listItems(pl.id)).toHaveLength(0)
    sqlite.close()
  })

  it('reorder persists the new sort order', () => {
    const { db, sqlite } = setup()
    seedPodcastWithEpisode(db)
    // Add two more episodes.
    for (let i = 0; i < 2; i++) {
      db.insert(episodes)
        .values({
          id: `ep-${i + 2}`,
          podcastId: 'pod-1',
          guid: `g${i + 2}`,
          title: `EP${i + 2}`,
          descriptionHtml: null,
          publishedAt: 1700000000000,
          audioUrl: `https://example.com/ep${i + 2}.mp3`,
          durationSec: 600,
          fileSizeBytes: 1024,
          isPlayed: false,
          playbackPositionSec: 0,
          isDownloaded: false
        })
        .run()
    }
    const repo = new PlaylistRepository(db)
    const pl = repo.create('列表')
    ;['ep-1', 'ep-2', 'ep-3'].forEach((e) => repo.addItem(pl.id, e))

    repo.reorder(pl.id, ['ep-3', 'ep-1', 'ep-2'])
    const ordered = repo.listItems(pl.id).map((i) => i.episodeId)
    expect(ordered).toEqual(['ep-3', 'ep-1', 'ep-2'])
    sqlite.close()
  })
})

describe('NoteRepository', () => {
  it('creates, lists by episode, and deletes notes', () => {
    const { db, sqlite } = setup()
    seedPodcastWithEpisode(db)
    const repo = new NoteRepository(db)

    const note = repo.create('ep-1', 754, '重点')
    expect(note.timestampSec).toBe(754)

    const list = repo.listByEpisode('ep-1')
    expect(list).toHaveLength(1)
    expect(list[0]?.content).toBe('重点')
    expect(list[0]?.episodeTitle).toBe('EP1')

    repo.delete(note.id)
    expect(repo.listByEpisode('ep-1')).toHaveLength(0)
    sqlite.close()
  })
})
