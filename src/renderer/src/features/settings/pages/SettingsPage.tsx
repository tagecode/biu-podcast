import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { ImportPreview } from '@shared/backup'
import type { CleanupPreview, UpdateStatus } from '@shared/ipc-contract'
import { useSubscriptionStore } from '@/features/subscription/store'
import { formatFileSize } from '@/lib/format'

import * as settingsApi from '../api'
import { applyFontScale, applyTheme } from '@/lib/appearance'
import i18n, { resolveLanguage } from '@/lib/i18n'
import { ShortcutSettings } from '../components/ShortcutSettings'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

interface SettingsPageProps {
  onBack: () => void
  /** Navigate to the About page (version / license / feedback). */
  onOpenAbout: () => void
}

const REFRESH_OPTIONS = [
  { value: 'null', labelKey: 'settings.manual' },
  { value: '30', labelKey: 'settings.every30min' },
  { value: '60', labelKey: 'settings.every1hour' },
  { value: '360', labelKey: 'settings.every6hours' }
]

export function SettingsPage({ onBack, onOpenAbout }: SettingsPageProps): React.JSX.Element {
  const { t } = useTranslation()
  const loadSubscriptions = useSubscriptionStore((state) => state.load)

  const formatPreview = (preview: ImportPreview): string =>
    [
      t('settings.previewPodcasts', {
        added: preview.podcastsAdded,
        conflict: preview.podcastsConflict
      }),
      t('settings.previewEpisodes', {
        added: preview.episodesAdded,
        conflict: preview.episodesConflict
      }),
      t('settings.previewTasks', {
        added: preview.downloadTasksAdded,
        conflict: preview.downloadTasksConflict
      })
    ].join('\n')

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState<string>('null')
  const [openFullDefault, setOpenFullDefault] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [closeToTray, setCloseToTray] = useState(false)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [fontScale, setFontScale] = useState<90 | 100 | 110 | 120>(100)
  const [language, setLanguage] = useState<'system' | 'zh' | 'en'>('system')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ phase: 'idle' })
  const [downloadDir, setDownloadDir] = useState<string>('')
  const [storageUsage, setStorageUsage] = useState<{
    podcasts: Array<{
      podcastId: string
      podcastTitle: string
      bytes: number
      downloadedCount: number
    }>
    totalBytes: number
  } | null>(null)
  const [cleanupRetention, setCleanupRetention] = useState<string>('null')
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null)
  const [loggingEnabled, setLoggingEnabled] = useState(true)
  const [pendingImport, setPendingImport] = useState<{
    filePath: string
    preview: ImportPreview
  } | null>(null)

  useEffect(() => {
    void settingsApi.getSettings().then((settings) => {
      setAutoRefresh(
        settings.autoRefreshMinutes == null ? 'null' : String(settings.autoRefreshMinutes)
      )
      setOpenFullDefault(settings.openFullPlayerDefault)
      setNotificationsEnabled(settings.notificationsEnabled)
      setCloseToTray(settings.closeToTray)
      setTheme(settings.theme)
      setFontScale(settings.fontScale)
      setLanguage(settings.language)
      setCleanupRetention(
        settings.cleanupRetentionDays == null ? 'null' : String(settings.cleanupRetentionDays)
      )
      setLoggingEnabled(settings.loggingEnabled)
    })
    // Resolve the actual download directory (default or custom).
    void window.api.download.getDir().then((r) => {
      if (r.ok) setDownloadDir(r.data)
    })
    // Load storage usage + retention preview.
    void window.api.storage.usage().then((r) => {
      if (r.ok) setStorageUsage(r.data)
    })
    void window.api.storage.cleanupPreview().then((r) => {
      if (r.ok) setCleanupPreview(r.data)
    })
  }, [])

  const refreshCleanupPreview = async (): Promise<void> => {
    const result = await window.api.storage.cleanupPreview()
    if (result.ok) setCleanupPreview(result.data)
  }

  // Update-status subscription: react to lifecycle events pushed by main.
  useEffect(() => {
    const unsubscribe = window.api.update.onStatus((status) => setUpdateStatus(status))
    void window.api.update.getStatus().then((result) => {
      if (result.ok) setUpdateStatus(result.data)
    })
    return unsubscribe
  }, [])

  const handleOpenDownloadDir = async (): Promise<void> => {
    try {
      await window.api.settings.openDirectory()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.openDirFailed'))
    }
  }

  const handleChooseDownloadDir = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.settings.chooseDirectory()
      if (!result.ok || !result.data) return
      setDownloadDir(result.data)
      await settingsApi.setSetting('downloadPath', result.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.chooseDirFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await settingsApi.exportBackup()
      if (!result) {
        setMessage(t('settings.exportCancelled'))
        return
      }
      setMessage(t('settings.exportDone', { path: result.filePath }))
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('settings.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleChooseImport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await settingsApi.previewImportBackup()
      if (!result) {
        setMessage(t('settings.importCancelled'))
        return
      }
      setPendingImport(result)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t('settings.readBackupFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmImport = async (strategy: 'skip' | 'overwrite'): Promise<void> => {
    if (!pendingImport) return
    setBusy(true)
    setError(null)
    try {
      const preview = await settingsApi.importBackup(pendingImport.filePath, strategy)
      setPendingImport(null)
      await loadSubscriptions()
      setMessage(`${t('settings.importDone')}\n${formatPreview(preview)}`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t('settings.importFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleOpmlImport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.subscription.importOpml()
      if (!result.ok) {
        setMessage(t('settings.importCancelled'))
        return
      }
      const { data } = result
      if (!data) {
        setMessage(t('settings.importCancelled'))
        return
      }
      const { added, skipped, failed } = data
      await loadSubscriptions()
      setMessage(
        `${t('settings.importOpmlDone', { added, skipped })}${failed.length ? t('settings.importOpmlFailedCount', { count: failed.length }) : ''}`
      )
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t('settings.opmlImportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleOpmlExport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.subscription.exportOpml()
      if (!result.ok || !result.data) {
        setMessage(t('settings.exportCancelled'))
        return
      }
      setMessage(t('settings.exportOpmlDone', { path: result.data.filePath }))
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('settings.opmlExportFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleAutoRefreshChange = (value: string): void => {
    setAutoRefresh(value)
    const minutes = value === 'null' ? null : Number(value)
    void settingsApi.setSetting('autoRefreshMinutes', minutes).catch((e) => {
      setError(e instanceof Error ? e.message : t('settings.saveAutoRefreshFailed'))
    })
  }

  const handleThemeChange = (value: 'system' | 'light' | 'dark'): void => {
    setTheme(value)
    applyTheme(value)
    void settingsApi.setSetting('theme', value).catch((e) => {
      setError(e instanceof Error ? e.message : t('settings.saveThemeFailed'))
    })
  }

  const handleFontScaleChange = (value: string): void => {
    const scale = Number(value) as 90 | 100 | 110 | 120
    setFontScale(scale)
    applyFontScale(scale)
    void settingsApi.setSetting('fontScale', scale).catch((e) => {
      setError(e instanceof Error ? e.message : t('settings.saveFontScaleFailed'))
    })
  }

  const handleLanguageChange = (value: 'system' | 'zh' | 'en'): void => {
    setLanguage(value)
    void i18n.changeLanguage(resolveLanguage(value))
    void settingsApi.setSetting('language', value).catch((e) => {
      setError(e instanceof Error ? e.message : t('settings.saveFailed'))
    })
  }

  const handleCleanupRetentionChange = (value: string): void => {
    setCleanupRetention(value)
    const days = value === 'null' ? null : Number(value)
    void settingsApi.setSetting('cleanupRetentionDays', days).catch((e) => {
      setError(e instanceof Error ? e.message : t('settings.saveFailed'))
    })
    // Refresh the preview for the new retention window.
    void refreshCleanupPreview()
  }

  const handleRunCleanup = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.storage.cleanupRun()
      if (result.ok) {
        setMessage(
          t('settings.cleanupDone', {
            count: result.data.removedCount,
            size: formatFileSize(result.data.freedBytes)
          })
        )
      }
      // Refresh usage + preview after deletion.
      const usage = await window.api.storage.usage()
      if (usage.ok) setStorageUsage(usage.data)
      await refreshCleanupPreview()
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : t('settings.cleanupFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleClearCache = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await window.api.cleanup.clearCache()
      setMessage(t('settings.clearCacheDone'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.clearFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleClearAllData = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await window.api.cleanup.clearAllData()
      // The app relaunches; this message is a fallback if it doesn't.
      setMessage(t('settings.clearAllDataDone'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.clearFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleExportDiagnostics = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.diagnostics.export()
      if (!result.ok || !result.data) {
        setMessage(t('settings.exportCancelled'))
        return
      }
      setMessage(t('settings.exportDone', { path: result.data.filePath }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={onBack}>
          {t('common.back')}
        </button>
        <h1 className="text-base font-semibold text-ink">{t('settings.title')}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <section className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.dataSection')}</h2>
            <p className="mt-1 text-sm text-muted">{t('settings.dataSectionHint')}</p>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.exportData')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.exportDataHint')}</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleExport()}>
              {t('settings.export')}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.importData')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.importDataHint')}</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleChooseImport()}>
              {t('settings.import')}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.clearCache')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.clearCacheHint')}</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleClearCache()}>
              {t('settings.clearCache')}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.clearAllData')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.clearAllDataHint')}</div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={busy}>
                  {t('settings.clearAllData')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('settings.clearAllDataConfirmTitle')}</DialogTitle>
                  <DialogDescription>{t('settings.clearAllDataConfirmBody')}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => void handleClearAllData()}
                    disabled={busy}
                  >
                    {t('common.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {pendingImport ? (
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="text-sm font-medium text-ink">{t('settings.preview')}</div>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">
                {formatPreview(pendingImport.preview)}
              </pre>
              <p className="mt-2 text-xs text-muted">
                {t('settings.previewFile', { path: pendingImport.filePath })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void handleConfirmImport('skip')}>
                  {t('settings.importSkip')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleConfirmImport('overwrite')}
                >
                  {t('settings.importOverwrite')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setPendingImport(null)}>
                  {t('settings.importCancel')}
                </Button>
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.opmlSection')}</h2>
            <p className="mt-1 text-sm text-muted">{t('settings.opmlSectionHint')}</p>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.importOpml')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.importOpmlHint')}</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleOpmlImport()}>
              {t('settings.importOpml')}…
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.exportOpml')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.exportOpmlHint')}</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleOpmlExport()}>
              {t('settings.exportOpml')}…
            </Button>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.refreshSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.autoRefresh')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.autoRefreshHint')}</div>
            </div>
            <Select value={autoRefresh} onValueChange={handleAutoRefreshChange}>
              <SelectTrigger className="w-32" aria-label={t('settings.autoRefresh')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.playbackSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.openFullDefault')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.openFullDefaultHint')}</div>
            </div>
            <label className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="accent-amber-600"
                checked={openFullDefault}
                onChange={(e) => {
                  setOpenFullDefault(e.target.checked)
                  void settingsApi
                    .setSetting('openFullPlayerDefault', e.target.checked)
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : t('settings.saveFailed'))
                    )
                }}
              />
              <span className="ml-2 text-sm text-muted">
                {openFullDefault ? t('common.on') : t('common.off')}
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.notifications')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.notificationsHint')}</div>
            </div>
            <label className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="accent-amber-600"
                checked={notificationsEnabled}
                onChange={(e) => {
                  setNotificationsEnabled(e.target.checked)
                  void settingsApi
                    .setSetting('notificationsEnabled', e.target.checked)
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : t('settings.saveFailed'))
                    )
                }}
              />
              <span className="ml-2 text-sm text-muted">
                {notificationsEnabled ? t('common.on') : t('common.off')}
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.closeToTray')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.closeToTrayHint')}</div>
            </div>
            <label className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="accent-amber-600"
                checked={closeToTray}
                onChange={(e) => {
                  setCloseToTray(e.target.checked)
                  void settingsApi
                    .setSetting('closeToTray', e.target.checked)
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : t('settings.saveFailed'))
                    )
                }}
              />
              <span className="ml-2 text-sm text-muted">
                {closeToTray ? t('common.on') : t('common.off')}
              </span>
            </label>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.shortcutSection')}</h2>
          </div>

          <ShortcutSettings />

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.storageSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{t('settings.downloadDir')}</div>
              <div className="mt-1 truncate text-xs text-muted" title={downloadDir}>
                {downloadDir || t('settings.getDir')}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                disabled={busy || !downloadDir}
                onClick={() => void handleOpenDownloadDir()}
              >
                {t('settings.openDir')}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void handleChooseDownloadDir()}
              >
                {t('settings.chooseDir')}
              </Button>
            </div>
          </div>

          <div className="border-b border-line py-4">
            <div className="text-sm font-medium text-ink">{t('settings.storageUsage')}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.storageUsageHint')}</div>
            {storageUsage === null ? (
              <div className="mt-2 text-sm text-muted">{t('settings.loadingUsage')}</div>
            ) : storageUsage.podcasts.length === 0 ? (
              <div className="mt-2 text-sm text-muted">{t('settings.noDownloads')}</div>
            ) : (
              <>
                <div className="mt-2 text-sm font-medium text-ink">
                  {t('settings.storageTotal', { size: formatFileSize(storageUsage.totalBytes) })}
                </div>
                <ul className="mt-2 space-y-1">
                  {storageUsage.podcasts.map((podcast) => (
                    <li
                      key={podcast.podcastId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="min-w-0 truncate text-ink">{podcast.podcastTitle}</span>
                      <span className="ml-3 shrink-0 font-mono text-xs text-muted">
                        {formatFileSize(podcast.bytes)} ·{' '}
                        {t('episode.episodes', { count: podcast.downloadedCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.storageCleanup')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.storageCleanupHint')}</div>
              {cleanupPreview && cleanupPreview.items.length > 0 ? (
                <div className="mt-1 text-xs text-amber-700">
                  {t('settings.cleanupPreviewTitle', {
                    count: cleanupPreview.items.length,
                    size: formatFileSize(cleanupPreview.totalBytes)
                  })}
                </div>
              ) : cleanupPreview ? (
                <div className="mt-1 text-xs text-muted">{t('settings.cleanupPreviewEmpty')}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Select value={cleanupRetention} onValueChange={handleCleanupRetentionChange}>
                <SelectTrigger className="w-32" aria-label={t('settings.storageCleanup')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">{t('settings.cleanupOff')}</SelectItem>
                  <SelectItem value="7">{t('settings.cleanup7d')}</SelectItem>
                  <SelectItem value="30">{t('settings.cleanup30d')}</SelectItem>
                  <SelectItem value="90">{t('settings.cleanup90d')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                disabled={busy || !cleanupPreview || cleanupPreview.items.length === 0}
                onClick={() => void handleRunCleanup()}
              >
                {t('settings.cleanupRun')}
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.appearanceSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.theme')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.themeHint')}</div>
            </div>
            <Select
              value={theme}
              onValueChange={(v) => handleThemeChange(v as 'system' | 'light' | 'dark')}
            >
              <SelectTrigger className="w-32" aria-label={t('settings.theme')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
                <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.fontScale')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.fontScaleHint')}</div>
            </div>
            <Select value={String(fontScale)} onValueChange={handleFontScaleChange}>
              <SelectTrigger className="w-32" aria-label={t('settings.fontScale')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
                <SelectItem value="110">110%</SelectItem>
                <SelectItem value="120">120%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.language')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.languageHint')}</div>
            </div>
            <Select
              value={language}
              onValueChange={(v) => handleLanguageChange(v as 'system' | 'zh' | 'en')}
            >
              <SelectTrigger className="w-32" aria-label={t('settings.language')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('settings.langSystem')}</SelectItem>
                <SelectItem value="zh">{t('settings.langZh')}</SelectItem>
                <SelectItem value="en">{t('settings.langEn')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.updateSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.checkUpdate')}</div>
              <div className="mt-1 text-xs text-muted">
                {updateStatus.phase === 'disabled'
                  ? t('settings.devNoUpdate')
                  : updateStatus.phase === 'checking'
                    ? t('settings.checking')
                    : updateStatus.phase === 'available'
                      ? t('settings.updateAvailable', { version: updateStatus.version })
                      : updateStatus.phase === 'downloading'
                        ? t('settings.downloading', { percent: updateStatus.percent ?? 0 })
                        : updateStatus.phase === 'downloaded'
                          ? t('settings.downloaded')
                          : updateStatus.phase === 'error'
                            ? t('settings.updateError', {
                                message: updateStatus.message ?? t('settings.unknownError')
                              })
                            : updateStatus.phase === 'not-available'
                              ? t('settings.upToDate')
                              : t('settings.checkUpdateHint')}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {updateStatus.phase === 'available' ? (
                <Button variant="secondary" onClick={() => void window.api.update.download()}>
                  {t('settings.download')}
                </Button>
              ) : null}
              {updateStatus.phase === 'downloaded' ? (
                <Button variant="secondary" onClick={() => void window.api.update.install()}>
                  {t('settings.installRestart')}
                </Button>
              ) : null}
              {updateStatus.phase !== 'disabled' && updateStatus.phase !== 'downloaded' ? (
                <Button
                  variant="secondary"
                  disabled={updateStatus.phase === 'checking'}
                  onClick={() => void window.api.update.check()}
                >
                  {t('settings.checkUpdate')}
                </Button>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.aboutSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.aboutEntry')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.aboutEntryHint')}</div>
            </div>
            <Button variant="secondary" onClick={onOpenAbout}>
              {t('settings.view')}
            </Button>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">{t('settings.diagnosticsSection')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.diagnosticsLogging')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.diagnosticsLoggingHint')}</div>
            </div>
            <label className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="accent-amber-600"
                checked={loggingEnabled}
                onChange={(e) => {
                  setLoggingEnabled(e.target.checked)
                  void settingsApi
                    .setSetting('loggingEnabled', e.target.checked)
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : t('settings.saveFailed'))
                    )
                }}
              />
              <span className="ml-2 text-sm text-muted">
                {loggingEnabled ? t('common.on') : t('common.off')}
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">{t('settings.exportDiagnostics')}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.exportDiagnosticsHint')}</div>
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void handleExportDiagnostics()}
            >
              {t('settings.exportDiagnosticsBtn')}
            </Button>
          </div>

          {message ? (
            <div className="rounded-lg border border-line bg-amber-100/50 p-3 text-sm text-ink whitespace-pre-wrap">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
