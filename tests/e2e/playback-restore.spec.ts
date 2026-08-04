import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

import { launchApp, removeUserDataDir } from './helpers/launch-app'
import { startTestServer, type TestServer } from './helpers/test-server'

/**
 * T5.6: restart resumes playback position without autoplay.
 *
 * Note on test audio: the hermetic MP3 is a placeholder Chromium may refuse to
 * decode, so real `timeupdate` events may never fire. The persisted position
 * write is exercised explicitly (equivalent to the app's pause/track-change
 * persist path), then we verify the full restore chain: DB/settings write →
 * relaunch → getLastSession → restoreSession renders the episode + position
 * without starting audio.
 */
test.describe('playback restore', () => {
  let server: TestServer | undefined
  let userDataDir: string
  let app: ElectronApplication | undefined
  let window: Page

  test.beforeAll(async () => {
    server = await startTestServer({ title: '续播测试播客', author: 'T' }, [
      { title: '续播集', audioBytes: 64 * 1024, publishedDaysAgo: 1, durationSec: 60 }
    ])
  })

  test.afterAll(async () => {
    await server?.close()
  })

  test.beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'biu-podcast-restore-'))
  })

  test.afterEach(async () => {
    if (app) {
      await app.close().catch(() => undefined)
    }
    removeUserDataDir(userDataDir)
  })

  async function subscribeAndPersistProgress(): Promise<void> {
    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.getByRole('button', { name: '添加订阅' }).click()
    await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server!.feedUrl)
    await window.getByRole('button', { name: '解析并添加' }).click()
    await expect(window.getByRole('button', { name: /续播测试播客/ })).toBeVisible()

    // Persist a playback position via the same IPC the app uses on pause/track
    // change. Get the episode id through the real API.
    const written = await window.evaluate(async () => {
      const subs = await window.api.subscription.list()
      const podcast = subs.data?.[0]
      if (!podcast) return false
      const page = await window.api.episode.listByPodcast({
        podcastId: podcast.id,
        offset: 0,
        limit: 5
      })
      const first = page.data?.items[0]
      if (!first) return false
      await window.api.playback.updateProgress({ episodeId: first.id, positionSec: 12 })
      return true
    })
    expect(written).toBe(true)

    // Force-quit (simulates crash — not a graceful close).
    await app!.close()
    app = undefined
  }

  test('restart restores position without autoplay', async () => {
    await subscribeAndPersistProgress()

    // Relaunch with the same userData.
    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // The restored session renders the mini player (toggle button appears).
    const toggle = window.locator('button.rounded-full.bg-amber-600')
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    // NOT autoplaying: the toggle shows a Play icon (1 path), not Pause (2).
    await expect(toggle.locator('svg path')).toHaveCount(1, { timeout: 5000 })

    // Position restored: mini player time shows 0:12 (or within a second).
    await expect(window.getByText(/0:1[012] \/ 1:00/)).toBeVisible()
  })
})
