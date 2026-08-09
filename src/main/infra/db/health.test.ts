import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/fake-userdata' } }))

// Point the DB path at a temp dir per test so we can craft corrupt files.
let tempDir: string
let dbPath: string

const mocks = vi.hoisted(() => ({
  getDatabasePath: vi.fn()
}))

vi.mock('./client', () => ({
  getDatabasePath: () => mocks.getDatabasePath()
}))

import { checkDatabaseHealth } from './health'

function makeCorruptDb(): void {
  writeFileSync(dbPath, 'this is not a sqlite database at all')
}

function makeValidDb(): void {
  const db = new Database(dbPath)
  db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO t VALUES (1, 'x');`)
  db.close()
}

function makeBackup(): void {
  // A valid backup named like migrate.ts creates: <base>.bak-<ts>
  const backupPath = `${dbPath}.bak-1700000000000`
  const valid = new Database(backupPath)
  valid.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO t VALUES (1, 'ok');`)
  valid.close()
}

describe('checkDatabaseHealth', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'biu-health-'))
    dbPath = join(tempDir, 'biu-podcast.db')
    mocks.getDatabasePath.mockReturnValue(dbPath)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok without a message for a fresh install (no file)', () => {
    const result = checkDatabaseHealth()
    expect(result.ok).toBe(true)
    expect(result.message).toBe('')
  })

  it('returns ok for a healthy database', () => {
    makeValidDb()
    const result = checkDatabaseHealth()
    expect(result.ok).toBe(true)
    expect(result.message).toBe('')
  })

  it('restores from the newest migration backup when corrupt', () => {
    makeCorruptDb()
    makeBackup()
    const result = checkDatabaseHealth()
    expect(result.ok).toBe(true)
    expect(result.message).toContain('已从最近备份恢复')
    expect(result.preservedCorruptFile).toBe(false)
    // File now contains the backup (which is a valid DB again).
    const probe = new Database(dbPath, { readonly: true })
    const row = probe.prepare('SELECT name FROM t').get() as { name: string }
    probe.close()
    expect(row.name).toBe('ok')
  })

  it('preserves the corrupt file and starts fresh when no backup exists', () => {
    makeCorruptDb()
    const result = checkDatabaseHealth()
    expect(result.ok).toBe(true)
    expect(result.message).toContain('无法自动恢复')
    expect(result.preservedCorruptFile).toBe(true)
    // The original is gone (so a fresh db is created on next open)…
    expect(existsSync(dbPath)).toBe(false)
    // …but a .corrupt-* copy was kept.
    const files = readdirSync(tempDir) as string[]
    expect(files.some((f) => f.includes('.corrupt-'))).toBe(true)
  })
})
