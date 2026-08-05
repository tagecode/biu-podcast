import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('episode play button reflects playing state', async () => {
  const server = await startTestServer(
    { title: '状态测试播客', author: 'T' },
    [
      { title: '集一', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 300 },
      { title: '集二', audioBytes: 128 * 1024, publishedDaysAgo: 0, durationSec: 120 }
    ]
  )
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe and open detail.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()
  await window.getByRole('button', { name: /状态测试播客/ }).click()

  // Click the first episode's play button — it becomes a pause button.
  const rows = window.locator('div.rounded-md.border')
  await rows.first().getByRole('button', { name: '播放' }).click()
  await expect(rows.first().getByRole('button', { name: '暂停' })).toBeVisible({ timeout: 5000 })

  // Click it again — back to play (toggle).
  await rows.first().getByRole('button', { name: '暂停' }).click()
  await expect(rows.first().getByRole('button', { name: '播放' })).toBeVisible({ timeout: 5000 })

  // The other episode still shows a play button.
  await expect(rows.nth(1).getByRole('button', { name: '播放' })).toBeVisible()

  await app.close()
  await server.close()
})
