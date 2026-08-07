import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('download pause and cancel actually work', async () => {
  const server = await startTestServer(
    { title: '暂停下载播客', author: 'T' },
    [
      { title: '慢速集', audioBytes: 512 * 1024, publishedDaysAgo: 0, durationSec: 300 },
      { title: '快速集', audioBytes: 128 * 1024, publishedDaysAgo: 1, durationSec: 120 }
    ],
    { slowEpisodeIndex: 0, slowChunkDelayMs: 200, slowChunkSize: 64 * 1024 }
  )
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe, open detail.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()
  await window.getByRole('button', { name: /暂停下载播客/ }).click()

  // Start downloading the slow episode (first row = newest).
  const rows = window.locator('div.rounded-md.border')
  await rows.first().getByRole('button', { name: '下载' }).click()

  // Panel opens with a downloading task.
  await expect(window.getByText('下载队列 · 1 项')).toBeVisible()
  await expect(window.getByText(/下载中/)).toBeVisible({ timeout: 8000 })

  // Pause it.
  await window.getByRole('button', { name: '暂停', exact: true }).click()
  await expect(window.getByText(/已暂停/)).toBeVisible({ timeout: 8000 })

  // Cancel it.
  await window.getByRole('button', { name: '取消', exact: true }).click()
  await expect(window.getByText('下载队列 · 0 项')).toBeVisible({ timeout: 8000 })

  await app.close()
  await server.close()
})
