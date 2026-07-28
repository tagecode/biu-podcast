import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  AddSubscriptionInput,
  EnqueueDownloadInput,
  ListEpisodesInput,
  MarkAllPlayedInput,
  RefreshSubscriptionInput,
  RemoveSubscriptionInput,
  UpdateProgressInput
} from '@shared/ipc-contract'
import type { AppSettings, DownloadTask, Episode, IpcResult, Podcast } from '@shared/types'

const api = {
  subscription: {
    add: (input: AddSubscriptionInput): Promise<IpcResult<Podcast>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.add, input),
    list: (): Promise<IpcResult<Podcast[]>> => ipcRenderer.invoke(IPC_CHANNELS.subscription.list),
    remove: (input: RemoveSubscriptionInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.remove, input),
    refresh: (
      input: RefreshSubscriptionInput
    ): Promise<IpcResult<{ addedCount: number; podcast: Podcast }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.refresh, input),
    onChanged: (callback: (podcasts: Podcast[]) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, podcasts: Podcast[]): void =>
        callback(podcasts)
      ipcRenderer.on(IPC_CHANNELS.subscription.changed, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.subscription.changed, listener)
    }
  },
  episode: {
    listByPodcast: (input: ListEpisodesInput): Promise<IpcResult<Episode[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.listByPodcast, input),
    markAllPlayed: (input: MarkAllPlayedInput): Promise<IpcResult<{ updated: number }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.markAllPlayed, input),
    onChanged: (callback: (payload: { podcastId: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { podcastId: string }): void =>
        callback(payload)
      ipcRenderer.on(IPC_CHANNELS.episode.changed, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.episode.changed, listener)
    }
  },
  playback: {
    updateProgress: (input: UpdateProgressInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.playback.updateProgress, input)
  },
  download: {
    enqueue: (input: EnqueueDownloadInput): Promise<IpcResult<never>> =>
      Promise.resolve({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: `下载功能开发中: ${input.episodeId}` }
      }),
    list: (): Promise<IpcResult<DownloadTask[]>> => Promise.resolve({ ok: true, data: [] })
  },
  settings: {
    get: (): Promise<IpcResult<AppSettings>> =>
      Promise.resolve({
        ok: true,
        data: { downloadPath: null, resumeOnLaunch: true }
      })
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error fallback for dev without isolation
  window.api = api
}
