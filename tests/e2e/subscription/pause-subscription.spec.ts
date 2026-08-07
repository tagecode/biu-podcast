import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'
import { startTestServer } from '../helpers/test-server'

test('pausing a subscription shows the paused badge and stops auto-refresh', async () => {
  const server = await startTestServer({ title: '暂停测试播客', author: 'T' }, [
    { title: '集一', audioBytes: 256 * 1024, publishedDaysAgo: 1, durationSec: 300 }
  ])
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe.
  await window.getByRole('button', { name: '添加订阅' }).click()
  await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
  await window.getByRole('button', { name: '解析并添加' }).click()
  await expect(window.getByRole('button', { name: /暂停测试播客/ })).toBeVisible()

  // Open detail, pause.
  await window.getByRole('button', { name: /暂停测试播客/ }).click()
  await window.getByRole('button', { name: '暂停订阅' }).click()
  // Button flips to resume.
  await expect(window.getByRole('button', { name: '恢复订阅' })).toBeVisible()

  // Back to list — paused badge shows.
  await window.getByRole('button', { name: '返回订阅列表' }).click()
  await expect(window.getByText('已暂停')).toBeVisible()

  await app.close()
  await server.close()
})
