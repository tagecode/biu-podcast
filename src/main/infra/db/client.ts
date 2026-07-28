import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

import * as schema from './schema'

export type AppDatabase = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: AppDatabase | null = null

export function getDatabasePath(): string {
  const override = process.env.BIU_PODCAST_DB_PATH
  if (override) return override
  return join(app.getPath('userData'), 'biu-podcast.db')
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    sqlite = new Database(getDatabasePath())
    sqlite.pragma('foreign_keys = ON')
  }
  return sqlite
}

export function getDb(): AppDatabase {
  if (!db) {
    db = drizzle(getSqlite(), { schema })
  }
  return db
}

export function closeDb(): void {
  db = null
  if (sqlite) {
    sqlite.close()
    sqlite = null
  }
}

export function createMemoryDb(): { sqlite: Database.Database; db: AppDatabase } {
  const memory = new Database(':memory:')
  memory.pragma('foreign_keys = ON')
  return { sqlite: memory, db: drizzle(memory, { schema }) }
}
