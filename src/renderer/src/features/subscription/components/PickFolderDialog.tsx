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
import type { Folder } from '@shared/types'

interface PickFolderDialogProps {
  open: boolean
  folders: Folder[]
  onOpenChange: (open: boolean) => void
  onSelect: (folderId: string | null) => void
  onCreate: () => void
}

export function PickFolderDialog({
  open,
  folders,
  onOpenChange,
  onSelect,
  onCreate
}: PickFolderDialogProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscription.pickFolder')}</DialogTitle>
          <DialogDescription>{t('subscription.moveToFolder')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="flex w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-line/60"
              onClick={() => {
                onSelect(folder.id)
                onOpenChange(false)
              }}
            >
              {folder.name}
            </button>
          ))}
          <button
            type="button"
            className="flex w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-line/60"
            onClick={() => {
              onSelect(null)
              onOpenChange(false)
            }}
          >
            {t('subscription.uncategorized')}
          </button>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onCreate()
            }}
          >
            {t('subscription.newFolder')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
