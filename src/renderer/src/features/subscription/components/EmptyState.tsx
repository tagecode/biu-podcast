import { PodcastIcon, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onAdd: () => void
}

export function EmptyState({ onAdd }: EmptyStateProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <PodcastIcon className="mb-6 size-16 text-muted" strokeWidth={1.75} />
      <h2 className="mb-2 text-lg font-semibold text-ink">{t('subscription.emptyTitle')}</h2>
      <p className="mb-6 max-w-sm text-sm leading-5 text-muted">{t('subscription.emptyHint')}</p>
      <Button onClick={onAdd}>
        <Plus className="size-4" />
        {t('subscription.addFirst')}
      </Button>
    </div>
  )
}
