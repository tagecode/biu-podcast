import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('playlist and note round-trip through the UI', async () => {
  const server = await startTestServer(
    { title: '列表笔记播客', author: 'T' },
    [{ title: '集一', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 300 }]
  )
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe, open detail.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()
  await window.getByRole('button', { name: /列表笔记播客/ }).click()

  // Create a playlist via the header, then add the episode to it.
  await window.getByRole('button', { name: '播放列表' }).click()
  await window.getByRole('button', { name: '新建播放列表' }).click()
  await window.getByPlaceholder('列表名称').fill('通勤')
  await window.getByRole('button', { name: '确定' }).click()
  await expect(window.getByText('通勤')).toBeVisible()

  // Back to detail (via subscriptions list), add episode to playlist.
  await window.getByRole('button', { name: '返回' }).click()
  await window.getByRole('button', { name: /列表笔记播客/ }).click()
  await window.getByText('集一').click()
  await window.getByRole('button', { name: /通勤/ }).click()
  await window.getByRole('button', { name: '播放列表' }).click()
  await window.getByText('通勤').click()
  await expect(window.getByText('集一')).toBeVisible()

  await app.close()
  await server.close()
})
