import { MoreHorizontal, Plus, RefreshCw, Search, X } from 'lucide-react'
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
import { showContextMenu } from '@/lib/context-menu'
import { formatDate } from '@/lib/format'
import { notifyCopied } from '@/lib/copied-feedback'
import { cn } from '@/lib/utils'
import type { EpisodeSearchHit, Folder, Podcast } from '@shared/types'

import { AddSubscriptionDialog } from './AddSubscriptionDialog'
import { DeleteFolderDialog } from './DeleteFolderDialog'
import { EmptyState } from './EmptyState'
import { FolderNameDialog } from './FolderNameDialog'
import { PickFolderDialog } from './PickFolderDialog'
import { PodcastCard } from './PodcastCard'
import { UnsubscribeDialog } from './UnsubscribeDialog'
import { folderMoveMenuItems, groupPodcastsByFolder, type FolderFilter } from '../lib/folder-groups'
import { useSubscriptionStore } from '../store'

interface SubscriptionListViewProps {
  onOpenPodcast: (podcastId: string) => void
  onOpenEpisode?: (podcastId: string, episodeId: string) => void
}

const SEARCH_DEBOUNCE_MS = 250

type FolderNameDialogState =
  | { mode: 'create' }
  | { mode: 'rename'; folderId: string; name: string }
  | { mode: 'create-and-assign'; podcastId: string }

export function SubscriptionListView({
  onOpenPodcast,
  onOpenEpisode
}: SubscriptionListViewProps): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [unsubscribeTarget, setUnsubscribeTarget] = useState<Podcast | null>(null)
  const [downloadedOnly, setDownloadedOnly] = useState(false)
  const [episodeHits, setEpisodeHits] = useState<EpisodeSearchHit[]>([])
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const [folderNameDialog, setFolderNameDialog] = useState<FolderNameDialogState | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null)
  const [pickFolderPodcast, setPickFolderPodcast] = useState<Podcast | null>(null)
  const { t, i18n } = useTranslation()
  const {
    folders,
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
      void useSubscriptionStore.getState().loadFolders()
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
  const searching = query.trim().length > 0
  const groups = groupPodcastsByFolder(podcasts, folders, folderFilter, searching)
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  const applyMove = async (podcastId: string, action: string | null): Promise<void> => {
    if (!action) return
    if (action.startsWith('folder:')) {
      await useSubscriptionStore
        .getState()
        .setPodcastFolder(podcastId, action.slice('folder:'.length))
      return
    }
    if (action === 'uncategorized') {
      await useSubscriptionStore.getState().setPodcastFolder(podcastId, null)
      return
    }
    if (action === 'newFolder') {
      setFolderNameDialog({ mode: 'create-and-assign', podcastId })
      return
    }
    if (action === 'pickFolder') {
      const podcast = useSubscriptionStore.getState().podcasts.find((item) => item.id === podcastId)
      if (podcast) setPickFolderPodcast(podcast)
    }
  }

  const showPodcastMenu = async (podcast: Podcast, event: React.MouseEvent): Promise<void> => {
    const id = await showContextMenu(
      [
        { id: 'open', label: t('subscription.openDetail') },
        { id: 'refresh', label: t('subscription.refresh') },
        { id: 'copyLink', label: t('subscription.copyLink') },
        {
          id: podcast.isPaused ? 'resume' : 'pause',
          label: podcast.isPaused ? t('subscription.resume') : t('subscription.pause')
        },
        { id: 'moveTo', label: t('subscription.moveToFolder') },
        { id: 'remove', label: t('subscription.remove'), danger: true }
      ],
      event
    )
    if (id === 'open') onOpenPodcast(podcast.id)
    if (id === 'refresh') await useSubscriptionStore.getState().refresh(podcast.id)
    if (id === 'copyLink') {
      const result = await window.api.clipboard.writeText(podcast.feedUrl)
      if (!result.ok) throw new Error(result.error.message)
      notifyCopied()
    }
    if (id === 'pause' || id === 'resume') {
      await useSubscriptionStore.getState().setPaused(podcast.id, id === 'pause')
    }
    if (id === 'moveTo') {
      const moveId = await showContextMenu(
        folderMoveMenuItems(useSubscriptionStore.getState().folders, {
          uncategorized: t('subscription.uncategorized'),
          newFolder: t('subscription.newFolder'),
          pickFolder: t('subscription.pickFolder')
        }),
        event
      )
      await applyMove(podcast.id, moveId)
    }
    if (id === 'remove') setUnsubscribeTarget(podcast)
  }

  const showFolderMenu = async (folder: Folder, event: React.MouseEvent): Promise<void> => {
    const id = await showContextMenu(
      [
        { id: 'rename', label: t('subscription.renameFolder') },
        { id: 'delete', label: t('subscription.deleteFolder'), danger: true }
      ],
      event
    )
    if (id === 'rename') {
      setFolderNameDialog({ mode: 'rename', folderId: folder.id, name: folder.name })
    }
    if (id === 'delete') setDeleteFolderTarget(folder)
  }

  const folderNameTitle =
    folderNameDialog?.mode === 'rename'
      ? t('subscription.renameFolder')
      : t('subscription.newFolder')

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
        <select
          className="h-10 w-[9.5rem] shrink-0 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none hover:border-amber-600/60 focus-visible:border-amber-600 focus-visible:ring-[3px] focus-visible:ring-amber-600/15"
          aria-label={t('subscription.filterFolder')}
          value={folderFilter}
          onChange={(event) => setFolderFilter(event.target.value)}
        >
          <option value="all">{t('subscription.folderAll')}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
          <option value="uncategorized">{t('subscription.uncategorized')}</option>
        </select>
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
        <Button variant="ghost" onClick={() => setFolderNameDialog({ mode: 'create' })}>
          {t('subscription.newFolder')}
        </Button>
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
                <div className="space-y-6">
                  {groups.map((group) => {
                    const folder =
                      group.folderId === null
                        ? null
                        : (folders.find((item) => item.id === group.folderId) ?? null)
                    return (
                      <section key={group.key}>
                        <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 bg-paper/95 py-2 backdrop-blur-sm">
                          <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                            {group.name ?? t('subscription.uncategorized')}
                          </h2>
                          {folder ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t('subscription.folderActions')}
                              onClick={(event) => {
                                event.preventDefault()
                                void showFolderMenu(folder, event)
                              }}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                        {group.podcasts.length === 0 ? (
                          <p className="text-xs text-muted">
                            {t('subscription.noMatchingPodcasts')}
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                            {group.podcasts.map((podcast) => (
                              <PodcastCard
                                key={podcast.id}
                                podcast={podcast}
                                onClick={() => onOpenPodcast(podcast.id)}
                                onContextMenu={(event) => {
                                  event.preventDefault()
                                  void showPodcastMenu(podcast, event)
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    )
                  })}
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
                              {hit.podcastTitle} ·{' '}
                              {formatDate(hit.episode.publishedAt, i18n.language)}
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
      <UnsubscribeDialog
        open={unsubscribeTarget !== null}
        podcastTitle={unsubscribeTarget?.title ?? ''}
        onOpenChange={(open) => {
          if (!open) setUnsubscribeTarget(null)
        }}
        onConfirm={async (deleteData) => {
          if (!unsubscribeTarget) return
          await useSubscriptionStore.getState().remove(unsubscribeTarget.id, deleteData)
        }}
      />
      <FolderNameDialog
        key={
          folderNameDialog
            ? `${folderNameDialog.mode}:${folderNameDialog.mode === 'rename' ? folderNameDialog.folderId : folderNameDialog.mode === 'create-and-assign' ? folderNameDialog.podcastId : 'new'}`
            : 'closed'
        }
        open={folderNameDialog !== null}
        title={folderNameTitle}
        initialName={folderNameDialog?.mode === 'rename' ? folderNameDialog.name : ''}
        onOpenChange={(open) => {
          if (!open) setFolderNameDialog(null)
        }}
        onSubmit={async (name) => {
          if (!folderNameDialog) return
          if (folderNameDialog.mode === 'rename') {
            await useSubscriptionStore.getState().renameFolder(folderNameDialog.folderId, name)
            return
          }
          const folder = await useSubscriptionStore.getState().createFolder(name)
          if (folderNameDialog.mode === 'create-and-assign') {
            await useSubscriptionStore
              .getState()
              .setPodcastFolder(folderNameDialog.podcastId, folder.id)
          }
        }}
      />
      <DeleteFolderDialog
        open={deleteFolderTarget !== null}
        folderName={deleteFolderTarget?.name ?? ''}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteFolderTarget) return
          await useSubscriptionStore.getState().deleteFolder(deleteFolderTarget.id)
          if (folderFilter === deleteFolderTarget.id) setFolderFilter('all')
        }}
      />
      <PickFolderDialog
        open={pickFolderPodcast !== null}
        folders={folders}
        onOpenChange={(open) => {
          if (!open) setPickFolderPodcast(null)
        }}
        onSelect={(folderId) => {
          if (!pickFolderPodcast) return
          void useSubscriptionStore.getState().setPodcastFolder(pickFolderPodcast.id, folderId)
        }}
        onCreate={() => {
          if (!pickFolderPodcast) return
          setFolderNameDialog({ mode: 'create-and-assign', podcastId: pickFolderPodcast.id })
        }}
      />
    </div>
  )
}
