import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Playlist, PlaylistItem } from '@shared/types'

import { useDownloadStore } from '@/features/download/store'

import { PlaylistsPage } from './PlaylistsPage'
import { usePlaylistStore } from '../store'

function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 'pl-1',
    name: '晚间',
    createdAt: 1,
    itemCount: 1,
    ...overrides
  }
}

function makeItem(overrides: Partial<PlaylistItem> = {}): PlaylistItem {
  return {
    id: 'item-1',
    playlistId: 'pl-1',
    episodeId: 'ep-1',
    sortOrder: 0,
    addedAt: 1,
    episodeTitle: '第一集',
    podcastTitle: '科技早知道',
    ...overrides
  }
}

describe('PlaylistsPage context menu', () => {
  const rename = vi.fn()
  const deletePlaylist = vi.fn()
  const listItems = vi.fn()
  const removeItem = vi.fn()
  const showContextMenu = vi.fn()
  const enqueueMany = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    rename.mockResolvedValue({ ok: true as const, data: undefined })
    deletePlaylist.mockResolvedValue({ ok: true as const, data: undefined })
    listItems.mockResolvedValue({ ok: true as const, data: [makeItem()] })
    removeItem.mockResolvedValue({ ok: true as const, data: undefined })
    showContextMenu.mockResolvedValue({ ok: true as const, data: null })
    enqueueMany.mockResolvedValue({ enqueued: 1, skipped: 0 })
    window.api = {
      playlist: {
        list: vi.fn(async () => ({ ok: true as const, data: [makePlaylist()] })),
        rename,
        delete: deletePlaylist,
        listItems,
        removeItem
      },
      contextMenu: { show: showContextMenu }
    } as unknown as Window['api']
    usePlaylistStore.setState({
      playlists: [makePlaylist()],
      loading: false,
      error: null,
      load: vi.fn()
    })
    useDownloadStore.setState({ enqueueMany } as never)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renames a playlist from the native context menu', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('夜间')
    showContextMenu.mockResolvedValueOnce({ ok: true as const, data: 'rename' })
    render(<PlaylistsPage onBack={() => undefined} />)

    fireEvent.contextMenu(screen.getByText('晚间'))
    await waitFor(() => {
      expect(rename).toHaveBeenCalledWith({ playlistId: 'pl-1', name: '夜间' })
    })
  })

  it('removes an episode from the playlist via the item context menu', async () => {
    showContextMenu.mockResolvedValueOnce({ ok: true as const, data: 'removeFromPlaylist' })
    render(<PlaylistsPage onBack={() => undefined} />)

    fireEvent.click(screen.getByText('晚间'))
    fireEvent.contextMenu(await screen.findByText('第一集'))
    await waitFor(() => {
      expect(removeItem).toHaveBeenCalledWith({ playlistId: 'pl-1', episodeId: 'ep-1' })
    })
  })
})
