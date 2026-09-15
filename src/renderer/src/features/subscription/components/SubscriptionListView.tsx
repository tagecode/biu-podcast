import { Plus, RefreshCw, Search, X } from 'lucide-react'
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
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EpisodeSearchHit } from '@shared/types'

import { AddSubscriptionDialog } from './AddSubscriptionDialog'
import { EmptyState } from './EmptyState'
import { PodcastCard } from './PodcastCard'
import { useSubscriptionStore } from '../store'

interface SubscriptionListViewProps {
  onOpenPodcast: (podcastId: string) => void
  onOpenEpisode?: (podcastId: string, episodeId: string) => void
}

const SEARCH_DEBOUNCE_MS = 250

export function SubscriptionListView({
  onOpenPodcast,
  onOpenEpisode
}: SubscriptionListViewProps): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [downloadedOnly, setDownloadedOnly] = useState(false)
  const [episodeHits, setEpisodeHits] = useState<EpisodeSearchHit[]>([])
  const { t } = useTranslation()
  const {
    loading,
    error,
    query,
    sortKey,
    load,
    add,
    refreshAll,
    refreshingAll,
    lastRefreshAdded,
    setQuery,
    setSortKey,
    dismissRefreshResult,
    visiblePodcasts
  } = useSubscriptionStore()

  useEffect(() => {
    void load()
    const unsubscribe = window.api.subscription.onChanged((podcasts) => {
      useSubscriptionStore.setState({ podcasts, loading: false, error: null })
    })
    return unsubscribe
  }, [load])

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await window.api.episode.search({ query: keyword, downloadedOnly })
        if (cancelled) return
        if (!result.ok) {
          setEpisodeHits([])
          return
        }
        setEpisodeHits(result.data)
      })()
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, downloadedOnly])

  const podcasts = visiblePodcasts()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const searching = query.trim().length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {offline ? (
        <div className="flex h-10 items-center gap-2 bg-offline px-4 text-sm font-medium text-white">
          {t('subscription.offlineBanner')}
        </div>
      ) : null}

      {lastRefreshAdded != null ? (
        <div
          role="status"
          className="flex h-10 items-center gap-2 bg-amber-100 px-4 text-sm text-ink"
        >
          <span className="min-w-0 flex-1 truncate">
            {lastRefreshAdded > 0
              ? t('subscription.newEpisodeCount', { count: lastRefreshAdded })
              : t('subscription.noNewEpisodes')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted hover:bg-amber-200 hover:text-ink"
            aria-label={t('common.close')}
            onClick={dismissRefreshResult}
          >
            <X className="size-3.5" />
          </Button>
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
        {searching ? (
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="size-3.5 accent-amber-600"
              checked={downloadedOnly}
              onChange={(event) => setDownloadedOnly(event.target.checked)}
            />
            {t('subscription.downloadedOnly')}
          </label>
        ) : null}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void refreshAll()}
          disabled={offline || refreshingAll}
          aria-label={t('subscription.refreshAll')}
          aria-busy={refreshingAll}
        >
          <RefreshCw className={cn('size-4', refreshingAll && 'animate-spin')} />
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
        ) : !searching && podcasts.length === 0 ? (
          <EmptyState onAdd={() => setDialogOpen(true)} />
        ) : (
          <>
            {podcasts.length === 0 && searching ? (
              <div className="mb-6 text-sm text-muted">{t('subscription.noMatchingPodcasts')}</div>
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

            {searching ? (
              <div className="mt-8">
                <div className="mb-3 text-sm text-muted">{t('subscription.episodeHits')}</div>
                {episodeHits.length === 0 ? (
                  <p className="text-sm text-muted">{t('subscription.episodeHitsEmpty')}</p>
                ) : (
                  <ul className="space-y-2">
                    {episodeHits.map((hit) => (
                      <li key={hit.episode.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-md border border-transparent bg-surface px-4 py-3 text-left transition-colors hover:border-line hover:shadow-sm"
                          onClick={() =>
                            onOpenEpisode
                              ? onOpenEpisode(hit.episode.podcastId, hit.episode.id)
                              : onOpenPodcast(hit.episode.podcastId)
                          }
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {hit.episode.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted">
                              {hit.podcastTitle} · {formatDate(hit.episode.publishedAt)}
                            </span>
                          </span>
                          {hit.episode.isDownloaded ? (
                            <span className="shrink-0 text-xs text-success">
                              {t('episode.downloaded')}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <AddSubscriptionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={add} />
    </div>
  )
}
