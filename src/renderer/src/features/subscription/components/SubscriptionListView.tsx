import { Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
          当前无网络，无法添加新订阅。已下载内容可正常播放。
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="搜索播客…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-muted"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
        >
          <option value="recent">最近更新</option>
          <option value="unread">未听数量</option>
          <option value="title">名称</option>
        </select>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="刷新全部">
          <RefreshCw className="size-4" />
        </Button>
        <Button disabled={offline} onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          添加订阅
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
            <div className="mb-4 text-sm text-muted">我的订阅 · {podcasts.length} 个播客</div>
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
