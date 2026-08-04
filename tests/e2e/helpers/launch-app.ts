import { _electron as electron, type ElectronApplication } from 'playwright'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const USER_DATA_SYMBOL = Symbol('userDataDir')

/** Resolve the built main entry regardless of the module system the dev machine uses. */
function resolveMainEntry(): string {
  return require.resolve(join(__dirname, '..', '..', '..', 'out', 'main', 'index.js'))
}

/**
 * Launch the packaged main process under Playwright with a throwaway userData
 * directory, so runs never share state (SQLite DB, settings, single-instance
 * lock). The app creates the DB under userData via `app.getPath('userData')`.
 *
 * Pass `userDataDir` to reuse a directory (restart scenarios); otherwise a
 * fresh temp dir is created.
 */
export async function launchApp(options?: { userDataDir?: string }): Promise<ElectronApplication> {
  const userDataDir = options?.userDataDir ?? mkdtempSync(join(tmpdir(), 'biu-podcast-e2e-'))
  const app = await electron.launch({
    args: [resolveMainEntry(), `--user-data-dir=${userDataDir}`],
    cwd: join(__dirname, '..', '..', '..')
  })
  ;(app as unknown as Record<symbol, string>)[USER_DATA_SYMBOL] = userDataDir
  return app
}

/** Remove the throwaway userData directory after the app closed. */
export function cleanupUserData(app: ElectronApplication): void {
  const dir = (app as unknown as Record<symbol, string>)[USER_DATA_SYMBOL]
  if (dir) rmSync(dir, { recursive: true, force: true })
}

/** Remove a userData directory by explicit path (for restart scenarios). */
export function removeUserDataDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export interface DialogMockOptions {
  /** Path the save dialog should return (export). */
  exportPath?: string
  /** Path the open dialog should return (import preview). */
  importPath?: string
  /** When true, showSaveDialog resolves canceled. */
  exportCancelled?: boolean
  /** When true, showOpenDialog resolves canceled. */
  importCancelled?: boolean
}

/**
 * Monkeypatch Electron's `dialog` module in the main process so the
 * file-chooser flows (export/import) can be driven headlessly. `evaluate`'s
 * first argument is the live `electron` module of the main process.
 */
export async function mockNativeDialogs(
  app: ElectronApplication,
  options: DialogMockOptions
): Promise<void> {
  await app.evaluate((electronModule, opts) => {
    const electronMod = electronModule as typeof import('electron')
    electronMod.dialog.showSaveDialog = async () =>
      opts.exportCancelled
        ? { canceled: true, filePath: undefined }
        : { canceled: false, filePath: opts.exportPath }
    electronMod.dialog.showOpenDialog = async () =>
      opts.importCancelled
        ? { canceled: true, filePaths: [] }
        : { canceled: false, filePaths: opts.importPath ? [opts.importPath] : [] }
  }, options)
}
