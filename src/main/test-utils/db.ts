import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type Database from 'better-sqlite3'

import { createMemoryDb, type AppDatabase } from '../infra/db/client'
import { SettingsStore } from '../infra/settings/store'

export const CREATE_TABLES_SQL = `
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
`

export interface TestDb {
  db: AppDatabase
  sqlite: Database.Database
}

export function createTestDb(): TestDb {
  const { db, sqlite } = createMemoryDb()
  sqlite.exec(CREATE_TABLES_SQL)
  return { db, sqlite }
}

export function createTestSettings(): SettingsStore {
  const dir = mkdtempSync(join(tmpdir(), 'biu-settings-'))
  return new SettingsStore({ cwd: dir })
}
