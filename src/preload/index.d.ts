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
import type { EpisodeListPage } from '@shared/episode-list'
import type {
  AppSettings,
  DownloadTask,
  DownloadTaskStatus,
  Episode,
  IpcResult,
  PlaybackSession,
  Podcast
} from '@shared/types'

type DownloadProgressPayload = {
  taskId: string
  episodeId: string
  status: DownloadTaskStatus
  progressBytes: number
  totalBytes: number | null
}

declare global {
  interface Window {
    api: {
      subscription: {
        add: (input: AddSubscriptionInput) => Promise<IpcResult<Podcast>>
        list: () => Promise<IpcResult<Podcast[]>>
        remove: (input: RemoveSubscriptionInput) => Promise<IpcResult<void>>
        refresh: (
          input: RefreshSubscriptionInput
        ) => Promise<IpcResult<{ addedCount: number; podcast: Podcast }>>
        refreshAll: () => Promise<IpcResult<Array<{ podcastId: string; addedCount: number }>>>
        setPaused: (input: SetPausedInput) => Promise<IpcResult<void>>
        importOpml: () => Promise<IpcResult<OpmlImportResult | null>>
        exportOpml: () => Promise<IpcResult<{ filePath: string } | null>>
        onChanged: (callback: (podcasts: Podcast[]) => void) => () => void
      }
      episode: {
        listByPodcast: (input: ListEpisodesInput) => Promise<IpcResult<EpisodeListPage>>
        getById: (input: GetEpisodeInput) => Promise<IpcResult<Episode>>
        markAllPlayed: (input: MarkAllPlayedInput) => Promise<IpcResult<{ updated: number }>>
        markPlayed: (input: MarkPlayedInput) => Promise<IpcResult<{ changed: boolean }>>
        getAdjacent: (
          input: GetAdjacentInput
        ) => Promise<IpcResult<{ previous: Episode | null; next: Episode | null }>>
        onChanged: (callback: (payload: { podcastId: string }) => void) => () => void
      }
      playback: {
        updateProgress: (input: UpdateProgressInput) => Promise<IpcResult<void>>
        getLastSession: () => Promise<IpcResult<PlaybackSession | null>>
      }
      download: {
        enqueue: (input: EnqueueDownloadInput) => Promise<IpcResult<DownloadTask>>
        list: () => Promise<IpcResult<DownloadTask[]>>
        pause: (input: DownloadTaskIdInput) => Promise<IpcResult<void>>
        resume: (input: DownloadTaskIdInput) => Promise<IpcResult<void>>
        cancel: (input: DownloadTaskIdInput) => Promise<IpcResult<void>>
        verifyLocal: (
          input: VerifyLocalInput
        ) => Promise<IpcResult<{ exists: boolean; episode: Episode }>>
        onProgress: (callback: (payload: DownloadProgressPayload) => void) => () => void
      }
      settings: {
        get: () => Promise<IpcResult<AppSettings>>
        set: (input: SetSettingInput) => Promise<IpcResult<void>>
      }
      dataPortability: {
        export: () => Promise<IpcResult<{ filePath: string } | null>>
        previewImport: () => Promise<IpcResult<{ filePath: string; preview: ImportPreview } | null>>
        import: (input: ImportBackupInput) => Promise<IpcResult<ImportPreview>>
      }
      window: {
        minimize: () => Promise<IpcResult<void>>
        maximize: () => Promise<IpcResult<void>>
        close: () => Promise<IpcResult<void>>
        isMaximized: () => Promise<IpcResult<boolean>>
      }
    }
  }
}

export {}
