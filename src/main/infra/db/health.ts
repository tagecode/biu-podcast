import Database from 'better-sqlite3'
import { copyFileSync, existsSync, readdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'

import { getDatabasePath } from './client'
import { logError, logInfo, logWarn } from '../logger'

/**
 * Startup database health check (PRD §5.2「数据库自愈」).
 *
 * A corrupted database must not crash the app on launch. This runs BEFORE the
 * app's singleton sqlite handle is opened (and before migrations), using a
 * throwaway connection so the file isn't locked when we replace it:
 *
 * 1. `PRAGMA quick_check` — fast whole-file sanity check.
 * 2. Corrupt → restore from the newest migration backup (`migrate.ts` writes
 *    `.bak-*` copies before every migration). Migrations may be missing, but
 *    the schema is what migrations created, so a backup is the best recovery.
 * 3. No usable backup → preserve the corrupt file as `.corrupt-<ts>` and
 *    delete the original so the app starts with a fresh database.
 *
 * The caller shows the returned message to the user.
 */

export interface DbHealthResult {
  /** Whether the app can proceed with a usable database. */
  ok: boolean
  /** Human-readable message for the startup notification ('' = all good). */
  message: string
  /** A corrupt file was preserved (renamed) instead of overwritten. */
  preservedCorruptFile: boolean
}

function newestMigrationBackup(dbPath: string): string | null {
  const dir = dirname(dbPath)
  const base = dbPath.split(/[/\\]/).pop() ?? 'biu-podcast.db'
  try {
    const backups = readdirSync(dir)
      .filter((name) => name.startsWith(`${base}.bak-`))
      .sort()
      .reverse()
    return backups.length > 0 ? join(dir, backups[0]!) : null
  } catch {
    return null
  }
}

/**
 * Run the health check using a throwaway connection, repairing the file on
 * disk if needed. The caller must open/re-open the real connection afterwards.
 */
export function checkDatabaseHealth(): DbHealthResult {
  const dbPath = getDatabasePath()
  if (!existsSync(dbPath)) {
    // Fresh install — nothing to check.
    return { ok: true, message: '', preservedCorruptFile: false }
  }

  let corrupt = false
  try {
    // Throwaway connection (autoclose on GC / explicit close) — the app's real
    // handle isn't open yet, so the file can be replaced freely afterwards.
    const probe = new Database(dbPath, { readonly: true })
    try {
      const result = probe.pragma('quick_check') as Array<{ quick_check: string }>
      corrupt = result.some((row) => row.quick_check !== 'ok')
    } finally {
      probe.close()
    }
  } catch (error) {
    // The pragma itself threw (severely corrupt / not a db) — treat as corrupt.
    corrupt = true
    logError('db', `quick_check threw: ${String(error)}`)
  }

  if (!corrupt) {
    return { ok: true, message: '', preservedCorruptFile: false }
  }

  logWarn('db', `quick_check failed → attempting self-heal for ${dbPath}`)

  // 1. Restore from the newest migration backup if available.
  const backup = newestMigrationBackup(dbPath)
  if (backup) {
    try {
      copyFileSync(backup, dbPath)
      logInfo('db', `restored ${dbPath} from backup ${backup}`)
      return {
        ok: true,
        message: '本地数据库已损坏，已从最近备份恢复。',
        preservedCorruptFile: false
      }
    } catch (error) {
      logError('db', `restore from ${backup} failed: ${String(error)}`)
    }
  }

  // 2. No usable backup: preserve the corrupt file, delete the original so the
  //    app starts fresh. The user is told to re-import from an export.
  let preservedPath: string | null = null
  try {
    preservedPath = `${dbPath}.corrupt-${Date.now()}`
    copyFileSync(dbPath, preservedPath)
    logWarn('db', `preserved corrupt db at ${preservedPath}`)
  } catch (error) {
    logError('db', `could not preserve corrupt db: ${String(error)}`)
  }
  try {
    rmSync(dbPath, { force: true })
  } catch (error) {
    logError('db', `could not remove corrupt db: ${String(error)}`)
  }

  return {
    ok: true,
    message:
      '本地数据库已损坏且无法自动恢复，已保留损坏文件并以空库启动（可导入备份/导出数据恢复）。',
    preservedCorruptFile: preservedPath !== null
  }
}
