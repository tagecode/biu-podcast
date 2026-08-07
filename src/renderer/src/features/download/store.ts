import type { DownloadTask, DownloadTaskStatus } from '@shared/types'
import { create } from 'zustand'

import * as downloadApi from './api'

interface DownloadState {
  tasks: DownloadTask[]
  history: DownloadTask[]
  historyTotal: number
  historyLoading: boolean
  panelOpen: boolean
  loading: boolean
  error: string | null
  load: () => Promise<void>
  loadHistory: (reset?: boolean) => Promise<void>
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

const HISTORY_PAGE_SIZE = 50

// Throttle progress-driven re-renders so the panel (and its buttons) stays
// stable between interactions — otherwise every chunk rebuilds the task row
// and pause/cancel clicks get lost as the button is detached mid-click.
const lastProgressAt: Record<string, number> = {}
const PROGRESS_THROTTLE_MS = 300
export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  history: [],
  historyTotal: 0,
  historyLoading: false,
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
  loadHistory: async (reset = false) => {
    const { history, historyLoading, historyTotal } = get()
    if (historyLoading) return
    if (!reset && history.length >= historyTotal) return // all loaded
    const offset = reset ? 0 : history.length
    set({ historyLoading: true })
    try {
      const page = await downloadApi.listDownloadHistory(offset, HISTORY_PAGE_SIZE)
      set((state) => ({
        history: reset ? page.items : [...state.history, ...page.items],
        historyTotal: page.total,
        historyLoading: false
      }))
    } catch {
      set({ historyLoading: false })
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
      // Task not in the local list yet (enqueue's load() still in flight).
      if (index < 0) {
        if (payload.status === 'completed') {
          void get().load()
        }
        return state
      }
      // Status transitions always apply.
      const existing = state.tasks[index]
      if (existing && existing.status !== payload.status) {
        lastProgressAt[payload.taskId] = Date.now()
        if (payload.status === 'completed') {
          // Completed tasks leave the active list.
          return { tasks: state.tasks.filter((task) => task.id !== payload.taskId) }
        }
        const next = [...state.tasks]
        next[index] = {
          ...next[index],
          status: payload.status,
          progressBytes: payload.progressBytes,
          totalBytes: payload.totalBytes
        }
        return { tasks: next }
      }
      // Progress-only update: throttle to keep the row (and its buttons)
      // from being rebuilt on every chunk.
      const now = Date.now()
      if (now - (lastProgressAt[payload.taskId] ?? 0) < PROGRESS_THROTTLE_MS) {
        return state
      }
      lastProgressAt[payload.taskId] = now
      const next = [...state.tasks]
      next[index] = {
        ...next[index],
        progressBytes: payload.progressBytes,
        totalBytes: payload.totalBytes
      }
      return { tasks: next }
    })
  }
}))
