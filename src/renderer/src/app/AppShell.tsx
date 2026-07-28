import { Play } from 'lucide-react'
import { useState } from 'react'

import { SubscriptionListView } from '@/features/subscription/components/SubscriptionListView'
import { PodcastDetailPage } from '@/features/episode/pages/PodcastDetailPage'
import { FullScreenPlayer, MiniPlayer } from '@/features/playback/components/PlayerShell'

type Route = { name: 'subscriptions' } | { name: 'detail'; podcastId: string }

export function AppShell(): React.JSX.Element {
  const [route, setRoute] = useState<Route>({ name: 'subscriptions' })

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
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
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

      <MiniPlayer />
    </div>
  )
}
