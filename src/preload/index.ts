import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  AddSubscriptionInput,
  DownloadTaskIdInput,
  EnqueueDownloadInput,
  GetAdjacentInput,
  GetEpisodeInput,
  ImportBackupInput,
  ListEpisodesInput,
  MarkAllPlayedInput,
  MarkPlayedInput,
  OpmlImportResult,
  RefreshSubscriptionInput,
  RemoveSubscriptionInput,
  SetPausedInput,
  SetSettingInput,
  UpdateProgressInput,
  VerifyLocalInput
} from '@shared/ipc-contract'
import type { ImportPreview } from '@shared/backup'
import type {
  AppSettings,
  DownloadTask,
  DownloadTaskStatus,
  Episode,
  IpcResult,
  PlaybackSession,
  Podcast
} from '@shared/types'
import type { EpisodeListPage } from '@shared/episode-list'

export type DownloadProgressPayload = {
  taskId: string
  episodeId: string
  status: DownloadTaskStatus
  progressBytes: number
  totalBytes: number | null
}

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
    refreshAll: (): Promise<IpcResult<Array<{ podcastId: string; addedCount: number }>>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.refreshAll),
    setPaused: (input: SetPausedInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.setPaused, input),
    importOpml: (): Promise<IpcResult<OpmlImportResult | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.importOpml),
    exportOpml: (): Promise<IpcResult<{ filePath: string } | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.subscription.exportOpml),
    onChanged: (callback: (podcasts: Podcast[]) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, podcasts: Podcast[]): void =>
        callback(podcasts)
      ipcRenderer.on(IPC_CHANNELS.subscription.changed, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.subscription.changed, listener)
    }
  },
  episode: {
    listByPodcast: (input: ListEpisodesInput): Promise<IpcResult<EpisodeListPage>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.listByPodcast, input),
    getById: (input: GetEpisodeInput): Promise<IpcResult<Episode>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.getById, input),
    markAllPlayed: (input: MarkAllPlayedInput): Promise<IpcResult<{ updated: number }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.markAllPlayed, input),
    markPlayed: (input: MarkPlayedInput): Promise<IpcResult<{ changed: boolean }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.markPlayed, input),
    getAdjacent: (
      input: GetAdjacentInput
    ): Promise<IpcResult<{ previous: Episode | null; next: Episode | null }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.episode.getAdjacent, input),
    onChanged: (callback: (payload: { podcastId: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { podcastId: string }): void =>
        callback(payload)
      ipcRenderer.on(IPC_CHANNELS.episode.changed, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.episode.changed, listener)
    }
  },
  playback: {
    updateProgress: (input: UpdateProgressInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.playback.updateProgress, input),
    getLastSession: (): Promise<IpcResult<PlaybackSession | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.playback.getLastSession)
  },
  download: {
    enqueue: (input: EnqueueDownloadInput): Promise<IpcResult<DownloadTask>> =>
      ipcRenderer.invoke(IPC_CHANNELS.download.enqueue, input),
    list: (): Promise<IpcResult<DownloadTask[]>> => ipcRenderer.invoke(IPC_CHANNELS.download.list),
    pause: (input: DownloadTaskIdInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.download.pause, input),
    resume: (input: DownloadTaskIdInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.download.resume, input),
    cancel: (input: DownloadTaskIdInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.download.cancel, input),
    verifyLocal: (
      input: VerifyLocalInput
    ): Promise<IpcResult<{ exists: boolean; episode: Episode }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.download.verifyLocal, input),
    onProgress: (callback: (payload: DownloadProgressPayload) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: DownloadProgressPayload
      ): void => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.download.progress, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.download.progress, listener)
    }
  },
  settings: {
    get: (): Promise<IpcResult<AppSettings>> => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    set: (input: SetSettingInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.set, input)
  },
  dataPortability: {
    export: (): Promise<IpcResult<{ filePath: string } | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.dataPortability.export),
    previewImport: (): Promise<IpcResult<{ filePath: string; preview: ImportPreview } | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.dataPortability.previewImport),
    import: (input: ImportBackupInput): Promise<IpcResult<ImportPreview>> =>
      ipcRenderer.invoke(IPC_CHANNELS.dataPortability.import, input)
  },
  window: {
    minimize: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC_CHANNELS.window.minimize, {}),
    maximize: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC_CHANNELS.window.maximize, {}),
    close: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC_CHANNELS.window.close, {}),
    isMaximized: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.window.isMaximized, {})
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error fallback for dev without isolation
  window.api = api
}
