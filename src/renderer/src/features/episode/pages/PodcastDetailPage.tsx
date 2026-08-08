import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Episode, Podcast } from '@shared/types'
import { EPISODE_PAGE_SIZE } from '@shared/episode-list'

import * as episodeApi from '../api'
import { EpisodeDetailPanel } from '../components/EpisodeDetailPanel'
import { EpisodeListItem } from '../components/EpisodeListItem'
import { useDownloadStore } from '@/features/download/store'
import { usePlaybackStore } from '@/features/playback/store'
import { UnsubscribeDialog } from '@/features/subscription/components/UnsubscribeDialog'
import { useSubscriptionStore } from '@/features/subscription/store'

interface PodcastDetailPageProps {
  podcastId: string
  onBack: () => void
}

export function PodcastDetailPage({
  podcastId,
  onBack
}: PodcastDetailPageProps): React.JSX.Element {
  const { t } = useTranslation()
  const podcast = useSubscriptionStore((state) =>
    state.podcasts.find((item) => item.id === podcastId)
  )
  const refreshSubscription = useSubscriptionStore((state) => state.refresh)
  const removeSubscription = useSubscriptionStore((state) => state.remove)
  const setSubscriptionPaused = useSubscriptionStore((state) => state.setPaused)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const playEpisode = usePlaybackStore((state) => state.playEpisode)
  const currentEpisodeId = usePlaybackStore((state) => state.currentEpisode?.id)
  const currentTimeSec = usePlaybackStore((state) => state.currentTimeSec)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const togglePlay = usePlaybackStore((state) => state.togglePlay)
  const stopIfPlayingPodcast = usePlaybackStore((state) => state.stopIfPlayingPodcast)
  const enqueueDownload = useDownloadStore((state) => state.enqueue)
  const listRef = useRef<HTMLDivElement>(null)

  const loadFirstPage = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const page = await episodeApi.listEpisodesPage(podcastId, 0, EPISODE_PAGE_SIZE)
      setEpisodes(page.items)
      setTotal(page.total)
      setUnreadCount(page.unreadCount)
      setHasMore(page.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('episode.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [podcastId, t])

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const page = await episodeApi.listEpisodesPage(podcastId, episodes.length, EPISODE_PAGE_SIZE)
      setEpisodes((prev) => {
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...page.items.filter((item) => !seen.has(item.id))]
      })
      setTotal(page.total)
      setUnreadCount(page.unreadCount)
      setHasMore(page.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('episode.loadMoreFailed'))
    } finally {
      setLoadingMore(false)
    }
  }, [episodes.length, hasMore, loadingMore, podcastId, t])

  const openEpisodeDetail = useCallback(
    async (episodeId: string): Promise<void> => {
      setDetailLoading(true)
      try {
        const detail = await episodeApi.getEpisode(episodeId)
        setSelectedEpisode(detail)
      } catch (detailError) {
        setError(detailError instanceof Error ? detailError.message : t('episode.loadDetailFailed'))
      } finally {
        setDetailLoading(false)
      }
    },
    [t]
  )

  useEffect(() => {
    const unsubscribe = window.api.episode.onChanged((payload) => {
      if (payload.podcastId === podcastId) void loadFirstPage()
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load is acceptable here
    void loadFirstPage()
    return unsubscribe
  }, [podcastId, loadFirstPage])

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const onScroll = (): void => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
      if (remaining < 240) void loadMore()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loadMore])

  if (!podcast) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        {t('subscription.podcastNotFound')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted hover:text-ink"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            {t('subscription.backToList')}
          </button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('subscription.refresh')}
            onClick={() => void refreshSubscription(podcastId).then(loadFirstPage)}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            variant="secondary"
            onClick={() => void episodeApi.markAllPlayed(podcastId).then(loadFirstPage)}
          >
            {t('episode.markAllPlayed')}
          </Button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6 flex gap-6">
            <div className="size-40 shrink-0 overflow-hidden rounded-lg bg-line">
              {podcast.coverUrl ? (
                <img
                  src={podcast.coverUrl}
                  alt={podcast.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-line text-5xl font-semibold text-muted">
                  {podcast.title.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-ink">{podcast.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {podcast.author
                  ? t('subscription.authorByline', { author: podcast.author })
                  : t('subscription.authorUnknown')}
                {podcast.language ? ` · ${podcast.language}` : ''}
              </p>
              {podcast.description ? (
                <p className="mt-3 line-clamp-3 text-sm leading-5 text-muted-700">
                  {podcast.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {t('subscription.unplayedCount', { count: unreadCount })}
                </Badge>
                <Badge variant="secondary">
                  {t('subscription.totalEpisodes', { count: total })}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    const latest = episodes[0]
                    if (latest) void playEpisode(latest, podcast)
                  }}
                  disabled={episodes.length === 0}
                >
                  {t('episode.playLatest')}
                </Button>
                <Button variant="secondary" onClick={() => setUnsubscribeOpen(true)}>
                  {t('subscription.remove')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void setSubscriptionPaused(podcastId, !podcast.isPaused)}
                >
                  {podcast.isPaused ? t('subscription.resume') : t('subscription.pause')}
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-3 text-sm text-muted">
            {t('episode.listTitle')}
            {total > 0
              ? ` · ${t('episode.loadedProgress', { count: episodes.length, total })}`
              : null}
            {detailLoading ? ` · ${t('episode.loadingDetail')}` : null}
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
              {error}
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <EpisodeListItem
                  key={episode.id}
                  episode={episode}
                  active={currentEpisodeId === episode.id}
                  isCurrentPlaying={currentEpisodeId === episode.id && isPlaying}
                  selected={selectedEpisode?.id === episode.id}
                  onPlay={() => {
                    if (currentEpisodeId === episode.id) {
                      togglePlay()
                    } else {
                      void playEpisode(episode, podcast as Podcast)
                    }
                  }}
                  onDownload={() => void enqueueDownload(episode.id)}
                  onOpenDetail={() => void openEpisodeDetail(episode.id)}
                />
              ))}
              {loadingMore ? (
                <div className="py-3 text-center text-xs text-muted">
                  {t('episode.loadingMore')}
                </div>
              ) : null}
              {!hasMore && episodes.length > 0 ? (
                <div className="py-3 text-center text-xs text-muted">{t('episode.allLoaded')}</div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {selectedEpisode ? (
        <EpisodeDetailPanel
          episode={selectedEpisode}
          onClose={() => setSelectedEpisode(null)}
          isCurrentPlaying={currentEpisodeId === selectedEpisode.id && isPlaying}
          currentPositionSec={currentEpisodeId === selectedEpisode.id ? currentTimeSec : 0}
          onPlay={() => {
            if (currentEpisodeId === selectedEpisode.id) {
              togglePlay()
            } else {
              void playEpisode(selectedEpisode, podcast)
            }
          }}
          onDownload={
            selectedEpisode.isDownloaded
              ? undefined
              : () => void enqueueDownload(selectedEpisode.id)
          }
        />
      ) : null}

      <UnsubscribeDialog
        open={unsubscribeOpen}
        podcastTitle={podcast.title}
        onOpenChange={setUnsubscribeOpen}
        onConfirm={async (deleteData) => {
          await removeSubscription(podcastId, deleteData)
          // If this podcast's episode was playing, the mini player must not
          // keep showing data that no longer exists.
          if (deleteData) stopIfPlayingPodcast(podcastId)
          onBack()
        }}
      />
    </div>
  )
}
