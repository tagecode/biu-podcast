import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ImportPreview } from '@shared/backup'
import { useSubscriptionStore } from '@/features/subscription/store'

import * as settingsApi from '../api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface SettingsPageProps {
  onBack: () => void
}

const REFRESH_OPTIONS = [
  { value: 'null', label: '手动' },
  { value: '30', label: '每 30 分钟' },
  { value: '60', label: '每 1 小时' },
  { value: '360', label: '每 6 小时' }
]

function formatPreview(preview: ImportPreview): string {
  return [
    `播客：新增 ${preview.podcastsAdded} / 冲突 ${preview.podcastsConflict}`,
    `集数：新增 ${preview.episodesAdded} / 冲突 ${preview.episodesConflict}`,
    `下载任务：新增 ${preview.downloadTasksAdded} / 冲突 ${preview.downloadTasksConflict}`
  ].join('\n')
}

export function SettingsPage({ onBack }: SettingsPageProps): React.JSX.Element {
  const loadSubscriptions = useSubscriptionStore((state) => state.load)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState<string>('null')
  const [openFullDefault, setOpenFullDefault] = useState(false)
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
    })
  }, [])

  const handleExport = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await settingsApi.exportBackup()
      if (!result) {
        setMessage('已取消导出')
        return
      }
      setMessage(`已导出到：${result.filePath}`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '导出失败')
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
        setMessage('已取消导入')
        return
      }
      setPendingImport(result)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '读取备份失败')
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
      setMessage(`导入完成\n${formatPreview(preview)}`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '导入失败')
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
        setMessage('已取消导入')
        return
      }
      const { data } = result
      if (!data) {
        setMessage('已取消导入')
        return
      }
      const { added, skipped, failed } = data
      await loadSubscriptions()
      setMessage(
        `OPML 导入完成：新增 ${added} 个，跳过 ${skipped} 个已订阅${failed.length ? `，失败 ${failed.length} 个` : ''}`
      )
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'OPML 导入失败')
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
        setMessage('已取消导出')
        return
      }
      setMessage(`已导出 OPML 到：${result.data.filePath}`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'OPML 导出失败')
    } finally {
      setBusy(false)
    }
  }

  const handleAutoRefreshChange = (value: string): void => {
    setAutoRefresh(value)
    const minutes = value === 'null' ? null : Number(value)
    void settingsApi.setSetting('autoRefreshMinutes', minutes).catch((e) => {
      setError(e instanceof Error ? e.message : '保存自动刷新设置失败')
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={onBack}>
          返回
        </button>
        <h1 className="text-base font-semibold text-ink">设置</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <section className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-ink">数据管理</h2>
            <p className="mt-1 text-sm text-muted">
              导出/导入订阅、播放进度与下载记录（不含音频文件本身）。
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">导出全部数据</div>
              <div className="mt-1 text-xs text-muted">生成 `.biubackup` 备份文件</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleExport()}>
              导出…
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">导入数据</div>
              <div className="mt-1 text-xs text-muted">导入前会预览新增与冲突数量</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleChooseImport()}>
              导入…
            </Button>
          </div>

          {pendingImport ? (
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="text-sm font-medium text-ink">导入预览</div>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">
                {formatPreview(pendingImport.preview)}
              </pre>
              <p className="mt-2 text-xs text-muted">文件：{pendingImport.filePath}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void handleConfirmImport('skip')}>
                  跳过冲突并导入
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleConfirmImport('overwrite')}
                >
                  覆盖冲突并导入
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setPendingImport(null)}>
                  取消
                </Button>
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold text-ink">订阅迁移（OPML）</h2>
            <p className="mt-1 text-sm text-muted">导入/导出订阅列表为标准 OPML 文件。</p>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">导入 OPML</div>
              <div className="mt-1 text-xs text-muted">批量导入订阅，重复条目自动跳过</div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleOpmlImport()}>
              导入 OPML…
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">导出 OPML</div>
              <div className="mt-1 text-xs text-muted">
                导出当前全部订阅，可被其他播客客户端识别
              </div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void handleOpmlExport()}>
              导出 OPML…
            </Button>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">刷新设置</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">自动刷新间隔</div>
              <div className="mt-1 text-xs text-muted">按设定间隔后台刷新订阅，发现新集通知</div>
            </div>
            <Select value={autoRefresh} onValueChange={handleAutoRefreshChange}>
              <SelectTrigger className="w-32" aria-label="自动刷新间隔">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">播放设置</h2>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <div className="text-sm font-medium text-ink">默认打开全屏播放器</div>
              <div className="mt-1 text-xs text-muted">点击播放时直接进入全屏播放器视图</div>
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
                    .catch((err) => setError(err instanceof Error ? err.message : '保存设置失败'))
                }}
              />
              <span className="ml-2 text-sm text-muted">{openFullDefault ? '开启' : '关闭'}</span>
            </label>
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
