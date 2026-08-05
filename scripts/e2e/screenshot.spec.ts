import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { startScreenshotServer } from './screenshot-server'

test('capture README screenshots', async () => {
  const servers = await Promise.all([
    startScreenshotServer({
      podcastTitle: '技术周刊 · 前端前沿',
      podcastAuthor: '主播小周',
      coverFile: 'cover-0.png',
      episodes: [
        { title: 'EP 12 · React 19 新特性实战', daysAgo: 0, minutes: 58 },
        { title: 'EP 11 · Electron 桌面应用安全基线', daysAgo: 3, minutes: 42 },
        { title: 'EP 10 · TypeScript 类型体操入门', daysAgo: 7, minutes: 65 }
      ]
    }),
    startScreenshotServer({
      podcastTitle: '深夜电台 · 城市漫游',
      podcastAuthor: '主播老陈',
      coverFile: 'cover-1.png',
      episodes: [
        { title: '城市夜景与便利店', daysAgo: 1, minutes: 36 },
        { title: '地铁末班车的乘客们', daysAgo: 5, minutes: 41 }
      ]
    }),
    startScreenshotServer({
      podcastTitle: '产品经理的自我修养',
      podcastAuthor: 'PM 笔记',
      coverFile: 'cover-2.png',
      episodes: [
        { title: '如何写出好的 PRD', daysAgo: 2, minutes: 49 },
        { title: 'MVP 的最小闭环', daysAgo: 6, minutes: 33 }
      ]
    }),
    startScreenshotServer({
      podcastTitle: '历史深处的回响',
      podcastAuthor: '史话工作室',
      coverFile: 'cover-3.png',
      episodes: [{ title: '丝绸之路上的城市', daysAgo: 4, minutes: 72 }]
    })
  ])

  const userDataDir = mkdtempSync(join(tmpdir(), 'biu-shot-'))
  const app = await electron.launch({
    args: [join(__dirname, '..', '..', 'out', 'main', 'index.js'), `--user-data-dir=${userDataDir}`],
    cwd: join(__dirname, '..', '..')
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Subscribe to all four podcasts.
  for (const server of servers) {
    await window.getByRole('button', { name: '添加订阅' }).click()
    await window.getByRole('dialog').getByLabel('RSS Feed 地址').fill(server.feedUrl)
    await window.getByRole('button', { name: '解析并添加' }).click()
    // The just-added podcast card appears (any of the four titles).
    await expect(window.getByRole('button', { name: /技术周刊|深夜电台|产品经理|历史深处/ }).first()).toBeVisible()
  }

  // Screenshot 1: subscription list.
  await expect(window.getByText('我的订阅 · 4 个播客')).toBeVisible()
  await window.waitForTimeout(500) // let covers load
  await window.screenshot({ path: 'assets/screenshots/list.png' })

  // Open the first podcast detail.
  await window.getByRole('button', { name: /技术周刊/ }).click()
  await expect(window.getByText('集数列表')).toBeVisible()
  await window.waitForTimeout(400)
  await window.screenshot({ path: 'assets/screenshots/detail.png' })

  await app.close()
  for (const server of servers) await server.close()
})
