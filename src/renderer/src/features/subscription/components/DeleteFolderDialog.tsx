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

interface DeleteFolderDialogProps {
  open: boolean
  folderName: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function DeleteFolderDialog({
  open,
  folderName,
  onOpenChange,
  onConfirm
}: DeleteFolderDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : t('subscription.createFolderFailed')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setError(null)
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscription.deleteFolder')}</DialogTitle>
          <DialogDescription>
            {t('subscription.deleteFolderConfirm', { name: folderName })}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="flex items-center gap-1 text-xs text-danger">
            <AlertCircle className="size-3.5" />
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" disabled={submitting} onClick={() => void handleConfirm()}>
            {submitting ? t('subscription.processing') : t('subscription.deleteFolder')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
