import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'

import { launchApp, cleanupUserData, mockNativeDialogs } from '../helpers/launch-app'
import { startTestServer, type TestServer } from '../helpers/test-server'

const PODCAST_TITLE = '测试播客 Golden Path'
const EPISODES = [
  { title: '第一集', audioBytes: 256 * 1024, publishedDaysAgo: 2, durationSec: 120 },
  { title: '第二集', audioBytes: 512 * 1024, publishedDaysAgo: 1, durationSec: 300 },
  { title: '第三集', audioBytes: 1024 * 1024, publishedDaysAgo: 0, durationSec: 600 }
]

test.describe('MVP golden path', () => {
  let app: ElectronApplication | undefined
  let window: Page
  let server: TestServer | undefined
  let backupPath: string

  test.beforeAll(async () => {
    server = await startTestServer(
      {
        title: PODCAST_TITLE,
        author: '测试作者',
        description: '用于 E2E 的本地测试播客',
        language: 'zh-cn'
      },
      EPISODES
    )
    const dir = join(tmpdir(), 'biu-e2e-backups')
    mkdirSync(dir, { recursive: true })
    backupPath = join(dir, `backup-${Date.now()}.biubackup`)
  })

  test.afterAll(async () => {
    await server?.close()
  })

  test.beforeEach(async () => {
    app = await launchApp()
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterEach(async () => {
    if (app) {
      await app.close()
      cleanupUserData(app)
    }
  })

  test('add → browse → play → download → export → import round-trips', async () => {
    // 1. Add subscription via the dialog
    await window.getByRole('button', { name: '添加订阅' }).click()
    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('RSS Feed 地址').fill(server!.feedUrl)
    await dialog.getByRole('button', { name: '解析并添加' }).click()

    // Podcast appears in the list
    await expect(window.getByText(PODCAST_TITLE)).toBeVisible({ timeout: 15_000 })

    // 2. Open podcast detail
    await window.getByText(PODCAST_TITLE).click()
    await expect(window.getByText('集数列表')).toBeVisible()
    await expect(window.getByText('共 3 集')).toBeVisible()
    // Unread count = 3
    await expect(window.getByText('3 集未听')).toBeVisible()

    // 3. Play the first episode (online)
    await window.getByRole('button', { name: '播放最新一集' }).click()
    // Mini player appears with the episode title
    await expect(window.getByText(EPISODES[0].title)).toBeVisible()
    // Audio element starts loading; wait for playback to start
    await expect(window.getByText('第一集')).toBeVisible()

    // 4. Download an episode
    // Each episode row has a button aria-label="下载" (the header one is
    // aria-label="下载队列"). Click the first episode download button.
    await window.getByRole('button', { name: '下载', exact: true }).first().click()
    // Download panel opens
    await expect(window.getByText('下载队列 · 1 项')).toBeVisible()
    // Wait for completion (task disappears from active list)
    await expect(window.getByText('下载队列 · 0 项')).toBeVisible({ timeout: 15_000 })

    // 5. Export data (dialog mocked to a temp path)
    await mockNativeDialogs(app!, { exportPath: backupPath })
    await window.getByRole('button', { name: '设置' }).click()
    await expect(window.getByText('数据管理')).toBeVisible()
    await window.getByRole('button', { name: '导出…' }).click()
    await expect(window.getByText(`已导出到：${backupPath}`)).toBeVisible()
    expect(existsSync(backupPath)).toBe(true)

    // 6. Import back into the same app (preview then confirm, skip strategy)
    // Re-mock dialogs so showOpenDialog returns the exported file.
    await mockNativeDialogs(app!, { importPath: backupPath })
    await window.getByRole('button', { name: '导入…' }).click()
    await expect(window.getByText('导入预览')).toBeVisible()
    await expect(window.getByText(/播客：新增 \d+ \/ 冲突 \d+/)).toBeVisible()
    await window.getByRole('button', { name: '跳过冲突并导入' }).click()
    await expect(window.getByText(/导入完成/)).toBeVisible()

    // 7. Podcast still present after import (podcast card heading in the list)
    await window.getByRole('button', { name: '返回' }).click()
    await expect(window.getByRole('button', { name: new RegExp(PODCAST_TITLE) })).toBeVisible()
  })
})
