import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
      setError(
        confirmError instanceof Error ? confirmError.message : t('subscription.removeFailed')
      )
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
          <DialogTitle>{t('subscription.remove')}</DialogTitle>
          <DialogDescription>
            {t('subscription.removeConfirmHint', { title: podcastTitle })}
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
            <Label className="text-sm font-medium text-ink">
              {t('subscription.deleteDataLabel')}
            </Label>
            <p className="mt-1 text-xs text-muted">{t('subscription.removeConfirm')}</p>
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
            {t('subscription.reconsider')}
          </Button>
          <Button
            variant={deleteData ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting
              ? t('subscription.processing')
              : deleteData
                ? t('subscription.removeWithData')
                : t('subscription.remove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
