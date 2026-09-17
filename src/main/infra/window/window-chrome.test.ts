import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MACOS_TRAFFIC_LIGHT_INSET_PX, MACOS_TRAFFIC_LIGHT_POSITION } from '@shared/window-chrome'

import { createWindowChromeOptions } from './window-chrome'

describe('createWindowChromeOptions', () => {
  it('keeps native traffic lights and centers them in the custom title bar on macOS', () => {
    expect(createWindowChromeOptions('darwin')).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: MACOS_TRAFFIC_LIGHT_POSITION
    })
  })

  it('uses a frameless window with custom controls on Windows', () => {
    expect(createWindowChromeOptions('win32')).toEqual({
      frame: false,
      autoHideMenuBar: true
    })
  })

  it('uses a frameless window with custom controls on Linux', () => {
    expect(createWindowChromeOptions('linux')).toEqual({
      frame: false,
      autoHideMenuBar: true
    })
  })

  it('reserves enough left inset to clear the traffic-light cluster', () => {
    const clusterEnd =
      MACOS_TRAFFIC_LIGHT_POSITION.x +
      12 /* close */ +
      8 /* gap */ +
      12 /* minimize */ +
      8 /* gap */ +
      12 /* zoom */
    expect(MACOS_TRAFFIC_LIGHT_INSET_PX).toBeGreaterThanOrEqual(clusterEnd + 12)
  })

  it('main entry wires createWindowChromeOptions into BrowserWindow', () => {
    const source = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8')
    expect(source).toContain('createWindowChromeOptions')
    expect(source).toMatch(/createWindowChromeOptions\(process\.platform\)/)
  })
})
