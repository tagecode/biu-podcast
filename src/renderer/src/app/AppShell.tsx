import { Download, ListMusic, Play, Settings, StickyNote } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { WindowControls } from '@/app/WindowControls'
import { DownloadPanel } from '@/features/download/components/DownloadPanel'
import { useDownloadStore } from '@/features/download/store'
import { PodcastDetailPage } from '@/features/episode/pages/PodcastDetailPage'
import { CopiedToast } from '@/features/episode/components/CopiedToast'
import { FullScreenPlayer, MiniPlayer } from '@/features/playback/components/PlayerShell'
import { loadPlaybackPrefs, restoreQueue, usePlaybackStore } from '@/features/playback/store'
import { NotesPage } from '@/features/playlist/pages/NotesPage'
import { PlaylistsPage } from '@/features/playlist/pages/PlaylistsPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { AboutPage } from '@/features/settings/pages/AboutPage'
import { OpmlImportPreviewDialog } from '@/features/subscription/components/OpmlImportPreviewDialog'
import { SubscriptionListView } from '@/features/subscription/components/SubscriptionListView'
import { useSubscriptionStore } from '@/features/subscription/store'
import { isEditableContextTarget, showContextMenu } from '@/lib/context-menu'
import type { OpmlPreviewItem, OpmlPreviewResult } from '@shared/ipc-contract'

declare module 'react' {
  interface CSSProperties {
    /** Non-standard Electron property; enables window dragging regions. */
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

/** -webkit-app-region is non-standard; Electron reads it for window dragging. */
const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' }
const noDragRegion: CSSProperties = { WebkitAppRegion: 'no-drag' }

type Route =
  | { name: 'subscriptions' }
  | { name: 'detail'; podcastId: string; episodeId?: string }
  | { name: 'playlists' }
  | { name: 'notes' }
  | { name: 'settings' }
  | { name: 'about' }

export function AppShell(): React.JSX.Element {
  const { t } = useTranslation()
  const [route, setRoute] = useState<Route>({ name: 'subscriptions' })
  const [dropMessage, setDropMessage] = useState<string | null>(null)
  const [opmlPreview, setOpmlPreview] = useState<OpmlPreviewResult | null>(null)
  const [opmlBusy, setOpmlBusy] = useState(false)
  const loadSubscriptions = useSubscriptionStore((state) => state.load)
  const playbackView = usePlaybackStore((state) => state.view)
  const panelOpen = useDownloadStore((state) => state.panelOpen)
  const tasks = useDownloadStore((state) => state.tasks)
  const setPanelOpen = useDownloadStore((state) => state.setPanelOpen)
  const loadDownloads = useDownloadStore((state) => state.load)
  const applyProgress = useDownloadStore((state) => state.applyProgress)
  const restoreSession = usePlaybackStore((state) => state.restoreSession)

  useEffect(() => {
    void loadDownloads()
    const unsubscribe = window.api.download.onProgress((payload) => {
      applyProgress(payload)
    })
    return unsubscribe
  }, [applyProgress, loadDownloads])

  useEffect(() => {
    void (async () => {
      const result = await window.api.playback.getLastSession()
      if (!result.ok || !result.data) return
      restoreSession(result.data.episode, result.data.podcast, result.data.positionSec)
    })()
  }, [restoreSession])

  // Restore the persisted playback queue (independent of the session episode).
  useEffect(() => {
    void restoreQueue()
  }, [])

  useEffect(() => {
    void loadPlaybackPrefs()
  }, [])

  // Global shortcuts / media keys / OS media session: main process sends a
  // playback command.
  useEffect(() => {
    const unsubscribe = window.api.playback.onCommand((command) => {
      const state = usePlaybackStore.getState()
      if (command === 'toggle') state.togglePlay()
      else if (command === 'play' && !state.isPlaying) state.togglePlay()
      else if (command === 'pause' && state.isPlaying) state.pause()
      else if (command === 'next') void state.playNext()
      else if (command === 'previous') void state.playPrevious()
    })
    return unsubscribe
  }, [])

  // Deep links: biu-podcast://subscribe?url=... → subscribe and show list;
  // biu-podcast://play/<episodeId> → open the podcast and play the episode.
  useEffect(() => {
    const unsubSubscribe = window.api.subscription.onDeepLinkSubscribe((feedUrl) => {
      setRoute({ name: 'subscriptions' })
      void useSubscriptionStore
        .getState()
        .add(feedUrl)
        .catch(() => undefined)
    })
    const unsubPlay = window.api.playback.onDeepLinkPlay((episodeId) => {
      void (async () => {
        const result = await window.api.episode.getById({ episodeId })
        if (!result.ok || !result.data) return
        const episode = result.data
        setRoute({ name: 'detail', podcastId: episode.podcastId })
        // Find the podcast and start playback.
        const subs = useSubscriptionStore.getState().podcasts
        const podcast = subs.find((p) => p.id === episode.podcastId)
        if (podcast) void usePlaybackStore.getState().playEpisode(episode, podcast)
      })()
    })
    return () => {
      unsubSubscribe()
      unsubPlay()
    }
  }, [])

  useEffect(() => {
    const onContextMenu = (event: MouseEvent): void => {
      if (!isEditableContextTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      void showContextMenu(
        [
          { id: 'cut', label: t('menu.cut') },
          { id: 'copy', label: t('menu.copy') },
          { id: 'paste', label: t('menu.paste') },
          { id: 'selectAll', label: t('menu.selectAll') }
        ],
        event
      )
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [t])

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    const file = files.find((item) => /\.(opml|xml)$/i.test(item.name))
    if (!file) {
      setDropMessage(t('subscription.dragImportInvalid'))
      return
    }
    const filePath = window.api.files.getPathForFile(file)
    const result = await window.api.subscription.previewOpmlPath({ filePath })
    if (!result.ok) {
      setDropMessage(result.error.message)
      return
    }
    setOpmlPreview(result.data)
  }

  const handleOpmlConfirm = async (items: OpmlPreviewItem[]): Promise<void> => {
    setOpmlBusy(true)
    try {
      const result = await window.api.subscription.importOpmlItems({ items })
      if (!result.ok) {
        setDropMessage(result.error.message)
        return
      }
      await loadSubscriptions()
      setOpmlPreview(null)
      setDropMessage(
        t('subscription.dragImportDone', {
          added: result.data.added,
          skipped: result.data.skipped,
          failed: result.data.failed.length
        })
      )
    } finally {
      setOpmlBusy(false)
    }
  }

  return (
    <div
      className="flex h-screen flex-col bg-paper text-ink"
      data-testid="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => void handleDrop(event)}
    >
      <header
        className="flex h-12 shrink-0 select-none items-center gap-3 border-b border-line bg-surface px-3"
        style={dragRegion}
      >
        <button
          type="button"
          className="flex items-center gap-2"
          onClick={() => setRoute({ name: 'subscriptions' })}
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-amber-600">
            <Play className="size-3.5 text-ink" strokeWidth={1.75} />
          </div>
          <span className="text-base font-semibold">{t('app.title')}</span>
        </button>
        <span className="text-sm text-muted">{t('app.subtitle')}</span>
        <div className="min-w-0 flex-1" />
        <div className="flex h-full items-center gap-1" style={noDragRegion}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('app.playlists')}
            onClick={() => setRoute({ name: 'playlists' })}
          >
            <ListMusic className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('app.notes')}
            onClick={() => setRoute({ name: 'notes' })}
          >
            <StickyNote className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('app.settings')}
            onClick={() => setRoute({ name: 'settings' })}
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('app.downloads')}
            className="relative"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            <Download className="size-4" />
            {tasks.length > 0 ? (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-600" />
            ) : null}
          </Button>
          <div className="mx-1 h-4 w-px bg-line" />
          <WindowControls />
        </div>
      </header>

      {dropMessage ? (
        <div
          className="border-b border-line bg-amber-100/50 px-4 py-2 text-sm text-ink"
          data-testid="drop-message"
        >
          {dropMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {route.name === 'subscriptions' ? (
            <SubscriptionListView
              onOpenPodcast={(podcastId) => setRoute({ name: 'detail', podcastId })}
              onOpenEpisode={(podcastId, episodeId) =>
                setRoute({ name: 'detail', podcastId, episodeId })
              }
            />
          ) : route.name === 'detail' ? (
            <PodcastDetailPage
              podcastId={route.podcastId}
              focusEpisodeId={route.episodeId}
              onBack={() => setRoute({ name: 'subscriptions' })}
            />
          ) : route.name === 'playlists' ? (
            <PlaylistsPage onBack={() => setRoute({ name: 'subscriptions' })} />
          ) : route.name === 'notes' ? (
            <NotesPage onBack={() => setRoute({ name: 'subscriptions' })} />
          ) : route.name === 'about' ? (
            <AboutPage onBack={() => setRoute({ name: 'settings' })} />
          ) : (
            <SettingsPage
              onBack={() => setRoute({ name: 'subscriptions' })}
              onOpenAbout={() => setRoute({ name: 'about' })}
            />
          )}
          <FullScreenPlayer />
        </main>
        <DownloadPanel />
      </div>

      {/* Hide the mini player while the full-screen player is open (it would
          otherwise overlap the full player's toolbar) and on the settings
          page (it's a config page; a persistent player there just eats
          space). */}
      {playbackView === 'mini' && route.name !== 'settings' ? <MiniPlayer /> : null}
      <CopiedToast />
      <OpmlImportPreviewDialog
        key={opmlPreview?.filePath ?? 'opml-closed'}
        preview={opmlPreview}
        busy={opmlBusy}
        onOpenChange={(open) => {
          if (!open) setOpmlPreview(null)
        }}
        onConfirm={handleOpmlConfirm}
      />
    </div>
  )
}
