import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('subscription card shows both unread and played counts, updated dynamically', async () => {
  const server = await startTestServer(
    { title: '计数播客', author: 'T' },
    [
      { title: '集一', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 300 },
      { title: '集二', audioBytes: 128 * 1024, publishedDaysAgo: 0, durationSec: 120 }
    ]
  )
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()

  // Card shows 2 unread, 0 played.
  await expect(window.getByText('2 集未听')).toBeVisible()
  await expect(window.getByText('0 集已听')).toBeVisible()

  // Open detail, mark one episode played.
  await window.getByRole('button', { name: /计数播客/ }).click()
  const result = await window.evaluate(async () => {
    const subs = await window.api.subscription.list()
    const podcast = subs.data![0]
    const page = await window.api.episode.listByPodcast({ podcastId: podcast.id, offset: 0, limit: 5 })
    const first = page.data!.items[0]
    await window.api.episode.markPlayed({ episodeId: first.id })
  })
  expect(result).toBeUndefined()

  // Back to list: counts updated to 1 unread / 1 played.
  await window.getByRole('button', { name: '返回订阅列表' }).click()
  await expect(window.getByText('1 集未听')).toBeVisible()
  await expect(window.getByText('1 集已听')).toBeVisible()

  await app.close()
  await server.close()
})
