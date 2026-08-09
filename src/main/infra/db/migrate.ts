import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'

import { getDatabasePath, getSqlite } from './client'
import { checkDatabaseHealth } from './health'
import { logInfo } from '../logger'

function getMigrationsDir(): string {
  const candidates: string[] = []
  // Packaged: drizzle/ ships as extraResources alongside the app bundle.
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, 'drizzle'))
  }
  // electron-vite dev / preview: repo root drizzle/ next to out/main.
  candidates.push(join(__dirname, '..', '..', 'drizzle'))
  // Fallback to app.getAppPath() when neither of the above is laid out
  // conventionally (e.g. running from a custom entry dir).
  candidates.push(join(app.getAppPath(), 'drizzle'))
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[1] ?? candidates[0] ?? candidates[2]
}

function runSqlStatements(sql: string): void {
  const sqlite = getSqlite()
  const statements = sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter(Boolean)

  for (const statement of statements) {
    sqlite.exec(statement)
  }
}

export function migrateDatabase(): string {
  const dbPath = getDatabasePath()
  mkdirSync(dirname(dbPath), { recursive: true })

  // Self-heal before migrations: repair/replace a corrupt database on disk so
  // opening it (and running migrations) can't crash the app.
  const health = checkDatabaseHealth()
  if (health.message) logInfo('db', health.message)

  const sqlite = getSqlite()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `)

  const applied = new Set(
    (sqlite.prepare('SELECT hash FROM __drizzle_migrations').all() as Array<{ hash: string }>).map(
      (row) => row.hash
    )
  )

  const migrationsDir = getMigrationsDir()
  if (!existsSync(migrationsDir)) return health.message

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue

    if (existsSync(dbPath)) {
      copyFileSync(dbPath, `${dbPath}.bak-${Date.now()}`)
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    try {
      runSqlStatements(sql)
      sqlite
        .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
        .run(file, Date.now())
    } catch (error) {
      const backups = readdirSync(dirname(dbPath))
        .filter((name) => name.startsWith(`${dbPath.split(/[/\\]/).pop()}.bak-`))
        .sort()
        .reverse()
      const latestBackup = backups[0]
      if (latestBackup) {
        copyFileSync(join(dirname(dbPath), latestBackup), dbPath)
      }
      throw error
    }
  }

  return health.message
}
