import { Download, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DownloadPanel } from '@/features/download/components/DownloadPanel'
import { useDownloadStore } from '@/features/download/store'
import { PodcastDetailPage } from '@/features/episode/pages/PodcastDetailPage'
import { FullScreenPlayer, MiniPlayer } from '@/features/playback/components/PlayerShell'
import { usePlaybackStore } from '@/features/playback/store'
import { SubscriptionListView } from '@/features/subscription/components/SubscriptionListView'

type Route = { name: 'subscriptions' } | { name: 'detail'; podcastId: string }

export function AppShell(): React.JSX.Element {
  const [route, setRoute] = useState<Route>({ name: 'subscriptions' })
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

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-amber-600">
            <Play className="size-4 text-ink" strokeWidth={1.75} />
          </div>
          <span className="text-lg font-semibold">博播</span>
        </div>
        <span className="text-sm text-muted">BiuPodcast</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="下载队列"
          className="relative"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <Download className="size-4" />
          {tasks.length > 0 ? (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-600" />
          ) : null}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {route.name === 'subscriptions' ? (
            <SubscriptionListView
              onOpenPodcast={(podcastId) => setRoute({ name: 'detail', podcastId })}
            />
          ) : (
            <PodcastDetailPage
              podcastId={route.podcastId}
              onBack={() => setRoute({ name: 'subscriptions' })}
            />
          )}
          <FullScreenPlayer />
        </main>
        <DownloadPanel />
      </div>

      <MiniPlayer />
    </div>
  )
}
