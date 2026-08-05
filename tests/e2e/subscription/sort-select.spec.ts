import { test, expect } from '@playwright/test'
import { launchApp } from '../helpers/launch-app'

test('sort select switches the sort key', async () => {
  const app = await launchApp()
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const trigger = window.getByRole('combobox', { name: '排序方式' })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveText('最近更新')

  // Open and pick 名称.
  await trigger.click()
  await window.getByRole('option', { name: '名称' }).click()
  await expect(trigger).toHaveText('名称')

  // Re-open: 名称 is checked, 最近更新 is not.
  await trigger.click()
  await expect(window.getByRole('option', { name: '名称' })).toHaveAttribute('data-state', 'checked')
  await expect(window.getByRole('option', { name: '最近更新' })).toHaveAttribute(
    'data-state',
    'unchecked'
  )
  await window.keyboard.press('Escape')

  await app.close()
})
