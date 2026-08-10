import { test, expect } from '@playwright/test'

import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('下载全部 enqueues every undownloaded episode of a podcast', async () => {
  const server = await startTestServer({ title: '批量下载播客', author: 'T' }, [
    { title: '第一集', audioBytes: 128 * 1024, publishedDaysAgo: 2, durationSec: 120 },
    { title: '第二集', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 240 },
    { title: '第三集', audioBytes: 512 * 1024, publishedDaysAgo: 0, durationSec: 480 }
  ])
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe, open detail.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()
  await window.getByRole('button', { name: /批量下载播客/ }).click()
  await expect(window.getByText('集数列表')).toBeVisible()

  // "下载全部" enqueues all 3 episodes and opens the download panel → 3 tasks.
  await window.getByRole('button', { name: '下载全部' }).click()
  await expect(window.getByText('下载队列 · 3 项')).toBeVisible({ timeout: 8000 })

  // Each of the three episode rows' download buttons are gone (all enqueued).
  const rows = window.locator('div.rounded-md.border')
  await expect(rows.first().getByRole('button', { name: '下载' })).toBeHidden()

  await app.close()
  await server.close()
})
