import { describe, expect, it } from 'vitest'

import {
  buildLinuxDesktopEntry,
  buildLoginItemSettings,
  resolveAutoLaunchKind,
  resolveLinuxAutostartPath
} from './index'

describe('auto-launch linux desktop entry', () => {
  it('builds an autostart desktop file pointing at the current executable', () => {
    const entry = buildLinuxDesktopEntry({
      appName: 'BiuPodcast',
      execPath: '/opt/BiuPodcast/biu-podcast'
    })
    expect(entry).toContain('Type=Application')
    expect(entry).toContain('Name=BiuPodcast')
    expect(entry).toContain('Exec=/opt/BiuPodcast/biu-podcast')
    expect(entry).toContain('X-GNOME-Autostart-enabled=true')
  })

  it('quotes Exec paths that contain spaces', () => {
    const entry = buildLinuxDesktopEntry({
      appName: 'BiuPodcast',
      execPath: '/opt/Biu Podcast/biu-podcast'
    })
    expect(entry).toContain('Exec="/opt/Biu Podcast/biu-podcast"')
  })

  it('resolves the autostart path under the user config dir', () => {
    expect(resolveLinuxAutostartPath('/home/alice', 'biu-podcast')).toBe(
      '/home/alice/.config/autostart/biu-podcast.desktop'
    )
  })
})

describe('auto-launch platform routing', () => {
  it('uses OS login items on Windows and macOS', () => {
    expect(resolveAutoLaunchKind('win32')).toBe('login-items')
    expect(resolveAutoLaunchKind('darwin')).toBe('login-items')
    expect(buildLoginItemSettings(true)).toEqual({ openAtLogin: true, openAsHidden: false })
    expect(buildLoginItemSettings(false)).toEqual({ openAtLogin: false, openAsHidden: false })
  })

  it('uses a desktop file on Linux and no-ops elsewhere', () => {
    expect(resolveAutoLaunchKind('linux')).toBe('linux-desktop')
    expect(resolveAutoLaunchKind('freebsd')).toBe('noop')
  })
})
