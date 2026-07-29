/**
 * Main-window renderer security baseline (Arch.md §8.1 / §15).
 * Kept as a single source of truth so regression tests can assert values
 * without launching Electron.
 */
export const MAIN_WINDOW_SECURITY_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false
} as const

export function createMainWindowWebPreferences(preloadPath: string): {
  preload: string
  sandbox: true
  contextIsolation: true
  nodeIntegration: false
} {
  return {
    preload: preloadPath,
    ...MAIN_WINDOW_SECURITY_PREFERENCES
  }
}
