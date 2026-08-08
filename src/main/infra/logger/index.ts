import { mkdir, appendFile, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

import { settingsStore } from '../settings/store'

const LOG_DIR_NAME = 'logs'
const LOG_FILE_NAME = 'biu-podcast.log'
const MAX_LOG_BYTES = 5 * 1024 * 1024 // 5 MB before rotating away.

let logDir: string | null = null

function getLogDir(): string {
  if (!logDir) logDir = join(app.getPath('userData'), LOG_DIR_NAME)
  return logDir
}

function isEnabled(): boolean {
  return settingsStore.getAll().loggingEnabled
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Append a line to the diagnostic log. Honours the `loggingEnabled` setting;
 * keeps the file bounded by truncating when it exceeds MAX_LOG_BYTES.
 */
export async function writeLog(
  level: 'info' | 'warn' | 'error',
  scope: string,
  message: string
): Promise<void> {
  if (!isEnabled()) return
  try {
    const dir = getLogDir()
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    const file = join(dir, LOG_FILE_NAME)
    // Bounded: if the file is already huge, start a fresh one.
    if (existsSync(file)) {
      try {
        const fileStat = await stat(file)
        if (fileStat.size > MAX_LOG_BYTES) {
          await rm(file, { force: true })
        }
      } catch {
        // Ignore stat races.
      }
    }
    await appendFile(file, `${nowIso()} [${level}] [${scope}] ${message}\n`, 'utf-8')
  } catch {
    // Logging must never crash the app.
  }
}

/** Lightweight synchronous variants for hot paths (download ticks etc.). */
export function logInfo(scope: string, message: string): void {
  void writeLog('info', scope, message)
}

export function logWarn(scope: string, message: string): void {
  void writeLog('warn', scope, message)
}

export function logError(scope: string, message: string): void {
  void writeLog('error', scope, message)
}

export interface DiagnosticInfo {
  appName: string
  appVersion: string
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
  /** Contents of the log file (or empty when disabled / absent). */
  log: string
  /** When logging is currently enabled. */
  loggingEnabled: boolean
  logFilePath: string
}

/** Collect environment + log content for the diagnostic export. */
export async function collectDiagnostics(): Promise<DiagnosticInfo> {
  const file = join(getLogDir(), LOG_FILE_NAME)
  let log = ''
  try {
    if (existsSync(file)) log = await readFile(file, 'utf-8')
  } catch {
    log = ''
  }
  return {
    appName: app.getName(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    log,
    loggingEnabled: isEnabled(),
    logFilePath: file
  }
}

/** Export diagnostics to a text file via the save dialog. Returns the path or null if cancelled. */
export async function exportDiagnostics(): Promise<{ filePath: string } | null> {
  const { dialog } = await import('electron')
  const defaultName = `biu-podcast-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`
  const result = await dialog.showSaveDialog({
    title: '导出诊断信息',
    defaultPath: defaultName,
    filters: [{ name: 'Diagnostics', extensions: ['txt'] }]
  })
  if (result.canceled || !result.filePath) return null

  const info = await collectDiagnostics()
  const body = [
    `BiuPodcast diagnostic report`,
    `======================`,
    `Generated: ${nowIso()}`,
    `App version: ${info.appVersion}`,
    `Platform: ${info.platform} ${info.arch}`,
    `Node: ${info.nodeVersion}`,
    `Electron: ${info.electronVersion}`,
    `Chromium: ${info.chromeVersion}`,
    `Logging enabled: ${info.loggingEnabled}`,
    `Log file: ${info.logFilePath}`,
    ``,
    `--- log ---`,
    info.log
  ].join('\n')
  await writeFile(result.filePath, body, 'utf-8')
  return { filePath: result.filePath }
}

/** Remove all log files (called by "clear cache"). */
export async function clearLogFiles(): Promise<void> {
  const dir = getLogDir()
  try {
    if (existsSync(dir)) {
      const files = await readdir(dir)
      for (const file of files) {
        await rm(join(dir, file), { force: true })
      }
    }
  } catch {
    // Best-effort.
  }
}
