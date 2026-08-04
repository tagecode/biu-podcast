import { defineConfig } from '@playwright/test'

/**
 * Electron E2E. `pnpm test:e2e` must run after `pnpm build` because
 * `_electron.launch` drives the compiled `out/main/index.js`.
 *
 * Tests run serially (workers: 1): each launch grabs the single-instance lock
 * with a fresh temp userData dir, but Electron's lock and window focus are
 * process-global, so serial avoids flakiness.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // Single worker: launching multiple Electron instances in parallel fights
  // over the single-instance lock and can leave orphaned processes.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']]
})
