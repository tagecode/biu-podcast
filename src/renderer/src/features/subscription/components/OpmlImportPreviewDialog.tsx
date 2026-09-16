import { useMemo, useState } from 'react'
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
import type { OpmlPreviewItem, OpmlPreviewResult } from '@shared/ipc-contract'

interface OpmlImportPreviewDialogProps {
  preview: OpmlPreviewResult | null
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (items: OpmlPreviewItem[]) => Promise<void>
}

export function OpmlImportPreviewDialog({
  preview,
  busy,
  onOpenChange,
  onConfirm
}: OpmlImportPreviewDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const items = useMemo(() => preview?.items ?? [], [preview])
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(items.map((_, index) => index))
  )

  const selectedItems = items.filter((_, index) => selected.has(index))
  const allSelected = items.length > 0 && selected.size === items.length

  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onOpenChange(false)
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('subscription.opmlPreviewTitle')}</DialogTitle>
          <DialogDescription>{t('subscription.opmlPreviewHint')}</DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted">{t('subscription.opmlPreviewEmpty')}</p>
        ) : (
          <div className="min-h-0 space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="accent-amber-600"
                checked={allSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelected(new Set(items.map((_, index) => index)))
                  } else {
                    setSelected(new Set())
                  }
                }}
              />
              {t('subscription.opmlPreviewSelectAll')}
            </label>
            <ul className="max-h-64 space-y-1 overflow-auto rounded-md border border-line p-2">
              {items.map((item, index) => (
                <li key={`${item.feedUrl}-${index}`}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-amber-600"
                      checked={selected.has(index)}
                      aria-label={item.title}
                      onChange={(event) => {
                        const next = new Set(selected)
                        if (event.target.checked) next.add(index)
                        else next.delete(index)
                        setSelected(next)
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{item.title}</span>
                      <span className="block truncate text-xs text-muted">{item.feedUrl}</span>
                      {item.folderName ? (
                        <span className="block truncate text-xs text-muted">
                          {t('subscription.opmlPreviewFolder', { name: item.folderName })}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy || selectedItems.length === 0}
            onClick={() => void onConfirm(selectedItems)}
          >
            {t('subscription.opmlPreviewConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
