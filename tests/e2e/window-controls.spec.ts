import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/launch-app'

/**
 * Verifies the window-control IPC surface is wired correctly: the title-bar
 * buttons render, and the window API domain round-trips through preload →
 * zod schema → handler without an INVALID_INPUT / unregistered-channel error.
 *
 * This is the regression for a real bug: the preload invoked window channels
 * with no payload, so the z.object({}) schema threw and every action silently
 * no-op'd (buttons did nothing). Asserting the invoke resolves ok:true catches
 * that wiring failure deterministically on every environment.
 *
 * We intentionally do NOT assert real window state (isMinimized etc.): on
 * headless CI (xvfb) there is no window manager, so those are unreliable. The
 * handler bodies are trivial (win.minimize()/maximize()/close()); the risk is
 * in the wiring, which ok:true covers.
 */
test('window controls are wired and round-trip through IPC', async () => {
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // The three controls render.
  await expect(window.getByRole('button', { name: '最小化' })).toBeVisible()
  await expect(window.getByRole('button', { name: '最大化' })).toBeVisible()
  await expect(window.getByRole('button', { name: '关闭' })).toBeVisible()

  // The window API domain works end-to-end. isMaximized is side-effect free;
  // it exercises the exact preload+schema+handler path that broke.
  const ok = await window.evaluate(async () => {
    const r = await window.api.window.isMaximized()
    return r.ok
  })
  expect(ok).toBe(true)

  await app.close()
})
