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
import { AddSubscriptionInputSchema } from '@shared/ipc-contract'

interface AddSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (feedUrl: string) => Promise<void>
}

export function AddSubscriptionDialog({
  open,
  onOpenChange,
  onSubmit
}: AddSubscriptionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [feedUrl, setFeedUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    const parsed = AddSubscriptionInputSchema.safeParse({ feedUrl })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('subscription.feedUrlInvalid'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(parsed.data.feedUrl)
      setFeedUrl('')
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('subscription.addFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null)
          setFeedUrl('')
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscription.add')}</DialogTitle>
          <DialogDescription>{t('subscription.addHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="feed-url">{t('subscription.feedUrlLabel')}</Label>
          <Input
            id="feed-url"
            placeholder={t('subscription.feedUrlPlaceholder')}
            value={feedUrl}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setFeedUrl(event.target.value)
              if (error) setError(null)
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
            {submitting ? t('subscription.resolving') : t('subscription.resolveAdd')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
