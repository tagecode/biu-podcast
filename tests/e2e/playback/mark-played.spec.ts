import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('marking an episode played refreshes the unread count', async () => {
  const server = await startTestServer(
    { title: '已听测试播客', author: 'T' },
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
  await window.getByRole('button', { name: /已听测试播客/ }).click()

  // 2 episodes unplayed.
  await expect(window.getByText('2 集未听')).toBeVisible()

  // Mark the first episode played via the same IPC the ended handler calls.
  const result = await window.evaluate(async () => {
    const subs = await window.api.subscription.list()
    const podcast = subs.data![0]
    const page = await window.api.episode.listByPodcast({ podcastId: podcast.id, offset: 0, limit: 5 })
    const first = page.data!.items[0]
    return window.api.episode.markPlayed({ episodeId: first.id })
  })
  expect(result.ok).toBe(true)
  expect(result.data!.changed).toBe(true)

  // Unread count drops to 1 and the row loses its unplayed dot.
  await expect(window.getByText('1 集未听')).toBeVisible({ timeout: 5000 })

  await app.close()
  await server.close()
})
