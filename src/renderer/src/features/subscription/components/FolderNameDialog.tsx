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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreateFolderInputSchema } from '@shared/ipc-contract'

interface FolderNameDialogProps {
  open: boolean
  title: string
  initialName?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<void>
}

export function FolderNameDialog({
  open,
  title,
  initialName = '',
  onOpenChange,
  onSubmit
}: FolderNameDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    const parsed = CreateFolderInputSchema.safeParse({ name })
    if (!parsed.success) {
      setError(t('subscription.folderNameInvalid'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(parsed.data.name)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t('subscription.createFolderFailed')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('subscription.folderNameLabel')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">{t('subscription.folderNameLabel')}</Label>
          <Input
            id="folder-name"
            placeholder={t('subscription.folderNamePlaceholder')}
            value={name}
            maxLength={80}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
          {error ? (
            <p className="flex items-center gap-1 text-xs text-danger">
              <AlertCircle className="size-3.5" />
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
