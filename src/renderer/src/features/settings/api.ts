import type { ImportPreview } from '@shared/backup'
import type { AppSettings } from '@shared/types'

export async function getSettings(): Promise<AppSettings> {
  const result = await window.api.settings.get()
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function setSetting(
  key:
    | 'autoRefreshMinutes'
    | 'playbackRate'
    | 'openFullPlayerDefault'
    | 'notificationsEnabled'
    | 'downloadPath'
    | 'closeToTray'
    | 'theme'
    | 'fontScale'
    | 'language',
  value: number | boolean | string | null
): Promise<void> {
  const result = await window.api.settings.set({ key, value })
  if (!result.ok) throw new Error(result.error.message)
}

export async function exportBackup(): Promise<{ filePath: string } | null> {
  const result = await window.api.dataPortability.export()
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function previewImportBackup(): Promise<{
  filePath: string
  preview: ImportPreview
} | null> {
  const result = await window.api.dataPortability.previewImport()
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function importBackup(
  filePath: string,
  strategy: 'skip' | 'overwrite'
): Promise<ImportPreview> {
  const result = await window.api.dataPortability.import({ filePath, strategy })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
