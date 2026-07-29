import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ImportPreview } from '@shared/backup'
import { useSubscriptionStore } from '@/features/subscription/store'

import * as settingsApi from '../api'

interface SettingsPageProps {
  onBack: () => void
}

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
  const [pendingImport, setPendingImport] = useState<{
    filePath: string
    preview: ImportPreview
  } | null>(null)

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
