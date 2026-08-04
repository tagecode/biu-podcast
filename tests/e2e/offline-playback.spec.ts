import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

import { launchApp, removeUserDataDir } from './helpers/launch-app'
import { startTestServer, type TestServer } from './helpers/test-server'

/**
 * T6.7: offline playback.
 *
 * 1. Download an episode fully (online).
 * 2. Simulate offline (navigator.onLine → false).
 * 3. Play the downloaded episode → plays fine (local file via biu-media://).
 * 4. Attempt to play a NOT-downloaded episode → explicit "无网络且未下载" prompt.
 */
test.describe('offline playback', () => {
  let server: TestServer | undefined
  let userDataDir: string
  let app: ElectronApplication | undefined
  let window: Page

  test.beforeAll(async () => {
    server = await startTestServer({ title: '离线测试播客', author: 'T' }, [
      { title: '已下载集', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 300 },
      { title: '未下载集', audioBytes: 128 * 1024, publishedDaysAgo: 0, durationSec: 120 }
    ])
  })

  test.afterAll(async () => {
    await server?.close()
  })

  test.beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'biu-podcast-offline-'))
  })

  test.afterEach(async () => {
    if (app) {
      await app.close().catch(() => undefined)
    }
    removeUserDataDir(userDataDir)
  })

  test('downloaded episode plays offline; undownloaded shows explicit prompt', async () => {
    // Launch and subscribe.
    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.getByRole('button', { name: '添加订阅' }).click()
    await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server!.feedUrl)
    await window.getByRole('button', { name: '解析并添加' }).click()
    await expect(window.getByRole('button', { name: /离线测试播客/ })).toBeVisible()

    // Open detail and download the first episode fully.
    await window.getByRole('button', { name: /离线测试播客/ }).click()
    const firstRow = window.locator('div.rounded-md.border').first()
    await firstRow.getByRole('button', { name: '下载', exact: true }).click()
    // Deterministic completion signal: the row's download button disappears.
    await expect(firstRow.getByRole('button', { name: '下载', exact: true })).toBeHidden({
      timeout: 15_000
    })
    // Close the download panel.
    await window.getByRole('button', { name: '关闭下载队列' }).click()

    // Simulate offline by overriding navigator.onLine in the renderer.
    await window.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true })
    })

    // Play the downloaded episode → should play (mini player appears with title).
    await window.getByRole('button', { name: '播放', exact: true }).first().click()
    await expect(window.getByText('已下载集')).toBeVisible()

    // Now try to play the NOT-downloaded episode → explicit offline prompt.
    // Episode rows are div.rounded-md.border; the second row is the undownloaded
    // episode. Clicking its play button while offline must surface the prompt.
    const episodeRows = window.locator('div.rounded-md.border')
    await episodeRows.nth(1).getByRole('button', { name: '播放' }).click()
    await expect(window.getByText(/无网络且未下载/)).toBeVisible()
  })
})
