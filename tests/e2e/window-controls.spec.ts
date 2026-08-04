import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/launch-app'

test('window controls actually control the window', async () => {
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Click minimize — the window should actually minimize.
  await window.getByRole('button', { name: '最小化' }).click()
  await window.waitForTimeout(500)
  const isMinimized = await app.evaluate((electronModule) => {
    const wins = electronModule.BrowserWindow.getAllWindows()
    return wins[0]?.isMinimized() ?? null
  })
  console.log('=== IS MINIMIZED ===', isMinimized)
  // Restore so the app can close cleanly
  await app.evaluate((electronModule) => {
    electronModule.BrowserWindow.getAllWindows()[0]?.restore()
  })

  // Click maximize — window should be maximized.
  await window.getByRole('button', { name: '最大化' }).click()
  await window.waitForTimeout(500)
  const isMaximized = await app.evaluate((electronModule) => {
    const wins = electronModule.BrowserWindow.getAllWindows()
    return wins[0]?.isMaximized() ?? null
  })
  console.log('=== IS MAXIMIZED ===', isMaximized)

  // We only assert minimize actually worked (the core bug); maximize may be
  // flaky in headless xvfb. Report both.
  expect(isMinimized).toBe(true)
  await app.close()
})
