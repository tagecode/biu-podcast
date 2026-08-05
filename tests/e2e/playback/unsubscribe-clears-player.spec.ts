import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('unsubscribing with delete clears the mini player', async () => {
  const server = await startTestServer({ title: '删除播客', author: 'T' }, [
    { title: '播放集', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 300 }
  ])
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe, open detail, start playing.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()
  await window.getByRole('button', { name: /删除播客/ }).click()
  await window.getByRole('button', { name: '播放最新一集' }).click()
  // Mini player appears.
  await expect(window.locator('button.rounded-full.bg-amber-600')).toBeVisible()

  // Unsubscribe with "delete data" checked.
  await window.getByRole('button', { name: '取消订阅' }).click()
  await window.getByRole('checkbox').check()
  await window.getByRole('button', { name: '取消并删除数据' }).click()

  // Back on the subscriptions list (empty state) and the mini player is gone.
  await expect(window.getByText('还没有订阅任何播客')).toBeVisible()
  await expect(window.locator('button.rounded-full.bg-amber-600')).toHaveCount(0)

  await app.close()
  await server.close()
})
