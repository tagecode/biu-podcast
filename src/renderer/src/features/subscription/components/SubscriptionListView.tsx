import { Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

import { AddSubscriptionDialog } from './AddSubscriptionDialog'
import { EmptyState } from './EmptyState'
import { PodcastCard } from './PodcastCard'
import { useSubscriptionStore } from '../store'

interface SubscriptionListViewProps {
  onOpenPodcast: (podcastId: string) => void
}

export function SubscriptionListView({
  onOpenPodcast
}: SubscriptionListViewProps): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { t } = useTranslation()
  const { loading, error, query, sortKey, load, add, setQuery, setSortKey, visiblePodcasts } =
    useSubscriptionStore()

  useEffect(() => {
    void load()
    const unsubscribe = window.api.subscription.onChanged((podcasts) => {
      useSubscriptionStore.setState({ podcasts, loading: false, error: null })
    })
    return unsubscribe
  }, [load])

  const podcasts = visiblePodcasts()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {offline ? (
        <div className="flex h-10 items-center gap-2 bg-offline px-4 text-sm font-medium text-white">
          {t('subscription.offlineBanner')}
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder={t('subscription.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={sortKey} onValueChange={setSortKey}>
          <SelectTrigger className="w-[9.5rem] shrink-0" aria-label={t('subscription.sortBy')}>
            <SelectValue placeholder={t('subscription.sortBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{t('subscription.sortRecent')}</SelectItem>
            <SelectItem value="unread">{t('subscription.sortUnread')}</SelectItem>
            <SelectItem value="title">{t('subscription.sortName')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void load()}
          aria-label={t('subscription.refreshAll')}
        >
          <RefreshCw className="size-4" />
        </Button>
        <Button disabled={offline} onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          {t('subscription.add')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/5] rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
            {error}
          </div>
        ) : podcasts.length === 0 ? (
          <EmptyState onAdd={() => setDialogOpen(true)} />
        ) : (
          <>
            <div className="mb-4 text-sm text-muted">
              {t('subscription.subscriptionCount', { count: podcasts.length })}
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {podcasts.map((podcast) => (
                <PodcastCard
                  key={podcast.id}
                  podcast={podcast}
                  onClick={() => onOpenPodcast(podcast.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <AddSubscriptionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={add} />
    </div>
  )
}
