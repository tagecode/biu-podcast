import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Point the DB at a throwaway temp file.
const tempDir = mkdtempSync(join(tmpdir(), 'biu-migrate-'))
process.env.BIU_PODCAST_DB_PATH = join(tempDir, 'biu-podcast.db')

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/fake-userdata',
    // getAppPath() must resolve to the repo root so getMigrationsDir()'s
    // fallback candidate finds the real drizzle/ directory.
    getAppPath: () => join(process.cwd())
  }
}))

import { migrateDatabase } from './migrate'
import { getSqlite, closeDb } from './client'

describe('migrateDatabase', () => {
  beforeAll(() => {
    // Fresh file per run.
    closeDb()
  })

  it('applies all migrations and creates the new P1.5 tables/columns', () => {
    migrateDatabase()
    const sqlite = getSqlite()

    // Migration ledger recorded every file.
    const applied = sqlite
      .prepare('SELECT hash FROM __drizzle_migrations ORDER BY id')
      .all() as Array<{ hash: string }>
    expect(applied.map((r) => r.hash)).toContain('0004_playback_queue.sql')
    expect(applied.map((r) => r.hash)).toContain('0005_episode_chapters_url.sql')

    // New tables/columns exist.
    const playbackQueue = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='playback_queue'").get()
    expect(playbackQueue).toBeTruthy()
    const chaptersCol = sqlite.prepare("PRAGMA table_info('episodes')").all() as Array<{ name: string }>
    expect(chaptersCol.some((c) => c.name === 'chapters_url')).toBe(true)
  })

  it('is idempotent — re-running applies no duplicate migrations', () => {
    migrateDatabase()
    migrateDatabase()
    const sqlite = getSqlite()
    const count = sqlite
      .prepare('SELECT COUNT(*) AS n FROM __drizzle_migrations')
      .get() as { n: number }
    const files = ['0000_init.sql', '0001_episode_indexes.sql', '0002_unsubscribe_soft.sql', '0003_playlist_note.sql', '0004_playback_queue.sql', '0005_episode_chapters_url.sql']
    expect(count.n).toBe(files.length)
  })
})
