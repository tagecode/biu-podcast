import { Plus, Trash2, ListMusic } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PlaylistItem } from '@shared/types'

import * as playlistApi from '../api'
import { usePlaylistStore } from '../store'

interface PlaylistsPageProps {
  onBack: () => void
}

export function PlaylistsPage({ onBack }: PlaylistsPageProps): React.JSX.Element {
  const { playlists, load, create, rename, remove } = usePlaylistStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  // Load items only when a playlist is selected; clearing the list on
  // deselect is handled by the click handler rather than a sync setState in
  // an effect.
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    void playlistApi.listPlaylistItems(selectedId).then((r) => {
      if (!cancelled) setItems(r)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const handleCreate = async (): Promise<void> => {
    if (!newName.trim()) return
    await create(newName.trim())
    setNewName('')
    setCreating(false)
  }

  const handleRename = async (playlistId: string): Promise<void> => {
    const name = window.prompt('播放列表名称', playlists.find((p) => p.id === playlistId)?.name)
    if (name && name.trim()) await rename(playlistId, name.trim())
  }

  const handleRemove = async (playlistId: string): Promise<void> => {
    if (!window.confirm('确定删除该播放列表？列表中的集数不会被删除。')) return
    await remove(playlistId)
    if (selectedId === playlistId) setSelectedId(null)
  }

  const handleReorder = useCallback(
    async (from: number, to: number): Promise<void> => {
      if (!selectedId || from === to) return
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      setItems(next)
      await playlistApi.reorderPlaylist(
        selectedId,
        next.map((i) => i.episodeId)
      )
    },
    [selectedId, items]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={onBack}>
          返回
        </button>
        <h1 className="text-base font-semibold text-ink">播放列表</h1>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: playlist list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-line">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-ink">我的列表</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="新建播放列表"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {creating ? (
            <div className="flex gap-2 px-4 pb-3">
              <Input
                autoFocus
                placeholder="列表名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate()
                }}
              />
              <Button size="sm" onClick={() => void handleCreate()}>
                确定
              </Button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {playlists.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">还没有播放列表</p>
            ) : (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={cn(
                    'group mb-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
                    selectedId === playlist.id
                      ? 'bg-amber-100 text-ink'
                      : 'text-muted-700 hover:bg-amber-100/50'
                  )}
                  onClick={() => setSelectedId(playlist.id)}
                >
                  <ListMusic className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                  <span className="text-xs text-muted">{playlist.itemCount ?? 0}</span>
                  <div className="hidden gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      aria-label="重命名"
                      className="rounded p-0.5 hover:bg-amber-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRename(playlist.id)
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label="删除播放列表"
                      className="rounded p-0.5 text-danger hover:bg-danger/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRemove(playlist.id)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: selected playlist items */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {selectedId ? (
            <>
              <div className="mb-3 text-sm font-medium text-ink">
                {playlists.find((p) => p.id === selectedId)?.name}
              </div>
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  空列表 —— 在集数详情中「添加到播放列表」
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) void handleReorder(dragIndex, index)
                        setDragIndex(null)
                      }}
                      className={cn(
                        'flex cursor-grab items-center gap-3 rounded-md border border-line bg-surface px-4 py-2.5',
                        dragIndex === index && 'opacity-50'
                      )}
                    >
                      <span className="font-mono text-xs text-muted">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {item.episodeTitle}
                        </div>
                        <div className="text-xs text-muted">{item.podcastTitle}</div>
                      </div>
                      <button
                        type="button"
                        aria-label="移除"
                        className="text-xs text-muted hover:text-danger"
                        onClick={() => {
                          void playlistApi
                            .removeFromPlaylist(selectedId, item.episodeId)
                            .then(() => {
                              setItems((prev) => prev.filter((i) => i.id !== item.id))
                            })
                        }}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              选择一个播放列表查看内容
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
