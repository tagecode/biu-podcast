import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

import { launchApp, removeUserDataDir } from './helpers/launch-app'

/**
 * P1-15b global-shortcut customization: the settings page lists the current
 * bindings, re-recording a combo round-trips through IPC and re-registers the
 * main-process shortcut, and a persisted custom binding is applied on restart.
 *
 * Recording uses `page.keyboard`, which dispatches real key events carrying
 * modifier state — the capture listener is on window keydown.
 */
test.describe('shortcut settings', () => {
  let userDataDir: string
  let app: ElectronApplication | undefined
  let window: Page

  test.beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'biu-podcast-shortcut-'))
  })

  test.afterEach(async () => {
    if (app) {
      await app.close().catch(() => undefined)
    }
    removeUserDataDir(userDataDir)
  })

  test('re-records a combo and persists it across restart', async () => {
    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // Open settings.
    await window.getByRole('button', { name: '设置' }).click()
    await expect(window.getByText('数据管理')).toBeVisible()

    // The shortcut section lists the three commands.
    await expect(window.getByRole('heading', { name: '快捷键' })).toBeVisible()
    await expect(window.getByText('播放/暂停')).toBeVisible()
    await expect(window.getByText('下一集')).toBeVisible()
    await expect(window.getByText('上一集')).toBeVisible()

    // Record a new combo for play/pause (first record button).
    await window.getByRole('button', { name: '录制快捷键' }).first().click()
    await expect(window.getByText('按下快捷键…')).toBeVisible()

    // Press Ctrl+Alt+T.
    await window.keyboard.press('Control+Alt+KeyT')

    // Feedback confirms the update.
    await expect(window.getByText('快捷键已更新：Ctrl + Alt + T')).toBeVisible()

    // Close cleanly, then relaunch with the same userData.
    await app!.close()
    app = undefined

    app = await launchApp({ userDataDir })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.getByRole('button', { name: '设置' }).click()
    await window.getByRole('heading', { name: '快捷键' }).waitFor()

    // The persisted custom binding shows after restart.
    await expect(window.getByText('Ctrl + Alt + T').first()).toBeVisible()
  })
})
