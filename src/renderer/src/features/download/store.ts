import type { DownloadTask, DownloadTaskStatus } from '@shared/types'
import { create } from 'zustand'

import * as downloadApi from './api'

interface DownloadState {
  tasks: DownloadTask[]
  panelOpen: boolean
  loading: boolean
  error: string | null
  load: () => Promise<void>
  enqueue: (episodeId: string) => Promise<void>
  pause: (taskId: string) => Promise<void>
  resume: (taskId: string) => Promise<void>
  cancel: (taskId: string) => Promise<void>
  setPanelOpen: (open: boolean) => void
  applyProgress: (payload: {
    taskId: string
    episodeId: string
    status: DownloadTaskStatus
    progressBytes: number
    totalBytes: number | null
  }) => void
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  panelOpen: false,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await downloadApi.listDownloads()
      set({ tasks, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '加载下载队列失败'
      })
    }
  },
  enqueue: async (episodeId) => {
    await downloadApi.enqueueDownload(episodeId)
    set({ panelOpen: true })
    await get().load()
  },
  pause: async (taskId) => {
    await downloadApi.pauseDownload(taskId)
    await get().load()
  },
  resume: async (taskId) => {
    await downloadApi.resumeDownload(taskId)
    await get().load()
  },
  cancel: async (taskId) => {
    await downloadApi.cancelDownload(taskId)
    await get().load()
  },
  setPanelOpen: (open) => set({ panelOpen: open }),
  applyProgress: (payload) => {
    set((state) => {
      const index = state.tasks.findIndex((task) => task.id === payload.taskId)
      if (index < 0) {
        if (payload.status === 'completed') return state
        void get().load()
        return state
      }
      if (payload.status === 'completed') {
        return {
          tasks: state.tasks.filter((task) => task.id !== payload.taskId)
        }
      }
      const next = [...state.tasks]
      next[index] = {
        ...next[index],
        status: payload.status,
        progressBytes: payload.progressBytes,
        totalBytes: payload.totalBytes
      }
      return { tasks: next }
    })
  }
}))
