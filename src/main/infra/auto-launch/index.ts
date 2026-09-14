import { app } from 'electron'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { posix } from 'path'

import { AppError } from '@shared/errors'

export interface AutoLaunchAdapter {
  isSupported(): boolean
  setEnabled(enabled: boolean): Promise<void>
}

export function resolveLinuxAutostartPath(homeDir: string, appId: string): string {
  return posix.join(homeDir, '.config', 'autostart', `${appId}.desktop`)
}

export function buildLinuxDesktopEntry(input: { appName: string; execPath: string }): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${input.appName}`,
    `Exec=${input.execPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
}

class LoginItemsAutoLaunch implements AutoLaunchAdapter {
  isSupported(): boolean {
    return process.platform === 'darwin' || process.platform === 'win32'
  }

  async setEnabled(enabled: boolean): Promise<void> {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: false })
  }
}

class LinuxAutoLaunch implements AutoLaunchAdapter {
  isSupported(): boolean {
    return process.platform === 'linux'
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const filePath = resolveLinuxAutostartPath(app.getPath('home'), 'biu-podcast')
    if (!enabled) {
      await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
      return
    }
    await mkdir(posix.dirname(filePath), { recursive: true })
    await writeFile(
      filePath,
      buildLinuxDesktopEntry({ appName: 'BiuPodcast', execPath: app.getPath('exe') }),
      'utf8'
    )
  }
}

class NoopAutoLaunch implements AutoLaunchAdapter {
  isSupported(): boolean {
    return false
  }

  async setEnabled(): Promise<void> {
    throw new AppError('NOT_SUPPORTED', '当前系统不支持开机自启')
  }
}

export function createAutoLaunch(): AutoLaunchAdapter {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return new LoginItemsAutoLaunch()
  }
  if (process.platform === 'linux') return new LinuxAutoLaunch()
  return new NoopAutoLaunch()
}

export const autoLaunch = createAutoLaunch()
