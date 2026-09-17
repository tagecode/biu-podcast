import { MACOS_TRAFFIC_LIGHT_POSITION } from '@shared/window-chrome'

export type MacWindowChromeOptions = {
  titleBarStyle: 'hiddenInset'
  trafficLightPosition: { x: number; y: number }
}

export type FramelessWindowChromeOptions = {
  frame: false
  autoHideMenuBar: true
}

export type WindowChromeOptions = MacWindowChromeOptions | FramelessWindowChromeOptions

/**
 * Platform window chrome for the custom title bar.
 * macOS keeps native traffic lights (hiddenInset); Windows/Linux are frameless
 * and use in-app window controls.
 */
export function createWindowChromeOptions(platform: NodeJS.Platform): WindowChromeOptions {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { ...MACOS_TRAFFIC_LIGHT_POSITION }
    }
  }
  return { frame: false, autoHideMenuBar: true }
}
