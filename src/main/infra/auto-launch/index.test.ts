import { describe, expect, it } from 'vitest'

import { buildLinuxDesktopEntry, resolveLinuxAutostartPath } from './index'

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

  it('resolves the autostart path under the user config dir', () => {
    expect(resolveLinuxAutostartPath('/home/alice', 'biu-podcast')).toBe(
      '/home/alice/.config/autostart/biu-podcast.desktop'
    )
  })
})
