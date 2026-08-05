import { defineConfig } from '@playwright/test'

/**
 * Dev-only config for capturing README screenshots. Not part of the CI
 * pipeline — run manually with:
 *   pnpm exec playwright test -c playwright.screenshot.config.ts
 */
export default defineConfig({
  testDir: 'scripts/e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']]
})
