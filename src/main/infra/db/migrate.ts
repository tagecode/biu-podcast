import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

import { getDatabasePath, getSqlite } from './client'

function getMigrationsDir(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'drizzle')
  }
  return join(process.resourcesPath, 'drizzle')
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

export function migrateDatabase(): void {
  const dbPath = getDatabasePath()
  mkdirSync(dirname(dbPath), { recursive: true })

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
  if (!existsSync(migrationsDir)) return

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
}
