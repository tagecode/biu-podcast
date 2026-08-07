import type { Playlist } from '@shared/types'
import { create } from 'zustand'

import * as playlistApi from './api'

interface PlaylistState {
  playlists: Playlist[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (name: string) => Promise<void>
  rename: (playlistId: string, name: string) => Promise<void>
  remove: (playlistId: string) => Promise<void>
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const playlists = await playlistApi.listPlaylists()
      set({ playlists, loading: false })
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '加载播放列表失败' })
    }
  },
  create: async (name) => {
    await playlistApi.createPlaylist(name)
    await get().load()
  },
  rename: async (playlistId, name) => {
    await playlistApi.renamePlaylist(playlistId, name)
    await get().load()
  },
  remove: async (playlistId) => {
    await playlistApi.deletePlaylist(playlistId)
    await get().load()
  }
}))
