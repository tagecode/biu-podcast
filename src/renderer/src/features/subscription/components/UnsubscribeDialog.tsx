import { AlertCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface UnsubscribeDialogProps {
  open: boolean
  podcastTitle: string
  onOpenChange: (open: boolean) => void
  onConfirm: (deleteData: boolean) => Promise<void>
}

export function UnsubscribeDialog({
  open,
  podcastTitle,
  onOpenChange,
  onConfirm
}: UnsubscribeDialogProps): React.JSX.Element {
  const [deleteData, setDeleteData] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(deleteData)
      setDeleteData(false)
      onOpenChange(false)
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : '取消订阅失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setDeleteData(false)
          setError(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>取消订阅</DialogTitle>
          <DialogDescription>
            确定取消订阅「{podcastTitle}」吗？默认保留本地集数与已下载文件，便于日后重新订阅。
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 rounded-md border border-line bg-paper px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 accent-amber-600"
            checked={deleteData}
            onChange={(event) => setDeleteData(event.target.checked)}
          />
          <div>
            <Label className="text-sm font-medium text-ink">同时删除全部本地数据</Label>
            <p className="mt-1 text-xs text-muted">
              将删除该播客的集数记录、下载任务，并清理已下载的音频文件。此操作不可恢复。
            </p>
          </div>
        </label>
        {error ? (
          <p className="flex items-center gap-1 text-xs text-danger">
            <AlertCircle className="size-3.5" />
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            再想想
          </Button>
          <Button
            variant={deleteData ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting ? '处理中…' : deleteData ? '取消并删除数据' : '取消订阅'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
