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
 * lock). The app creates the DB under userData via `app.getPath('userData')`;
 * we only point that path at a fresh temp dir and let the app do the rest.
 */
export async function launchApp(): Promise<ElectronApplication> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'biu-podcast-e2e-'))
  const app = await electron.launch({
    args: [resolveMainEntry()],
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
