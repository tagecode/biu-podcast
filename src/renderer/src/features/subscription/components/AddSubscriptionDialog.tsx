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
  const [feedUrl, setFeedUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    const parsed = AddSubscriptionInputSchema.safeParse({ feedUrl })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '请输入有效的 URL 地址')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(parsed.data.feedUrl)
      setFeedUrl('')
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '添加订阅失败')
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
          <DialogTitle>添加订阅</DialogTitle>
          <DialogDescription>
            输入播客的 RSS Feed 地址，我们将解析并展示播客信息供您确认。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="feed-url">RSS Feed 地址</Label>
          <Input
            id="feed-url"
            placeholder="https://example.com/podcast/feed.xml"
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
            取消
          </Button>
          <Button disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? '解析中…' : '解析并添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
