import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, cleanupUserData } from '../helpers/launch-app'

test.describe('MVP smoke', () => {
  let app: ElectronApplication | undefined

  test.afterEach(async () => {
    if (app) {
      await app.close()
      cleanupUserData(app)
    }
  })

  test('packaged app launches and shows the main window', async () => {
    app = await launchApp()
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await expect(window).toHaveTitle('博播 BiuPodcast')
    // The React root must actually render (not a blank white screen).
    await expect(window.locator('#root')).not.toBeEmpty()
  })
})
