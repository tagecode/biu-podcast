import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

import { launchApp, removeUserDataDir } from './helpers/launch-app'
import { startTestServer, type TestServer } from './helpers/test-server'

/**
 * T6.5: interrupted downloads auto-recover after app restart.
 *
 * Start a download of a SLOW episode (held mid-transfer), force-quit before it
 * finishes, relaunch with the same userData, and assert the task auto-resumes
 * (goes queued → downloading → completed) rather than staying stuck.
 */
test.describe('download resume', () => {
  let server: TestServer | undefined
  let userDataDir: string
  let app: ElectronApplication | undefined
  let window: Page

  test.beforeAll(async () => {
    // Episode 0 streams slowly and is the NEWEST (sorts first), so the first
    // download button in the list downloads it and holds it 'downloading'.
    server = await startTestServer(
      { title: '续传测试播客', author: 'T' },
      [
        { title: '慢速集', audioBytes: 512 * 1024, publishedDaysAgo: 0, durationSec: 300 },
        { title: '快速集', audioBytes: 128 * 1024, publishedDaysAgo: 1, durationSec: 120 }
      ],
      { slowEpisodeIndex: 0, slowChunkDelayMs: 120, slowChunkSize: 16 * 1024 }
    )
  })

  test.afterAll(async () => {
    await server?.close()
  })

  test.beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'biu-podcast-resume-'))
  })

  test.afterEach(async () => {
    if (app) {
      await app.close().catch(() => undefined)
    }
    removeUserDataDir(userDataDir)
  })

  test('interrupted download auto-recovers on restart', async () => {
    // First launch: subscribe and start downloading the slow episode.
    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.getByRole('button', { name: '添加订阅' }).click()
    await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server!.feedUrl)
    await window.getByRole('button', { name: '解析并添加' }).click()
    await expect(window.getByRole('button', { name: /续传测试播客/ })).toBeVisible()

    await window.getByRole('button', { name: /续传测试播客/ }).click()
    // Download the slow episode (first row). Header button is '下载队列'.
    await window.getByRole('button', { name: '下载', exact: true }).first().click()
    // Panel opens with 1 task, stuck downloading (slow stream).
    await expect(window.getByText('下载队列 · 1 项')).toBeVisible()
    await expect(window.getByText(/下载中/)).toBeVisible({ timeout: 5000 })

    // Force-quit mid-download (no graceful pause/close).
    await app!.close()
    app = undefined

    // Relaunch with same userData. The task was 'downloading' in the DB; the
    // app should auto-queue it and resume (slow stream continues to completion).
    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // Open the download panel — the task should auto-recover and complete.
    await window.getByRole('button', { name: '下载队列' }).click()
    // It eventually completes and disappears from the active list.
    await expect(window.getByText('下载队列 · 0 项')).toBeVisible({ timeout: 30_000 })
  })
})
