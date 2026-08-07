import type {
  AddSubscriptionInput,
  CreateNoteInput,
  CreatePlaylistInput,
  DownloadTaskIdInput,
  EnqueueDownloadInput,
  EpisodeIdInput,
  GetAdjacentInput,
  GetEpisodeInput,
  ImportBackupInput,
  ListEpisodesInput,
  MarkAllPlayedInput,
  MarkPlayedInput,
  NoteIdInput,
  OpmlImportResult,
  PlaylistIdInput,
  PlaylistItemInput,
  RefreshSubscriptionInput,
  RemoveSubscriptionInput,
  RenamePlaylistInput,
  ReorderPlaylistInput,
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
  Note,
  PlaybackSession,
  Playlist,
  PlaylistItem,
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
      playlist: {
        create: (input: CreatePlaylistInput) => Promise<IpcResult<Playlist>>
        list: () => Promise<IpcResult<Playlist[]>>
        rename: (input: RenamePlaylistInput) => Promise<IpcResult<void>>
        delete: (input: PlaylistIdInput) => Promise<IpcResult<void>>
        addItem: (input: PlaylistItemInput) => Promise<IpcResult<void>>
        removeItem: (input: PlaylistItemInput) => Promise<IpcResult<void>>
        listItems: (input: PlaylistIdInput) => Promise<IpcResult<PlaylistItem[]>>
        reorder: (input: ReorderPlaylistInput) => Promise<IpcResult<void>>
      }
      note: {
        create: (input: CreateNoteInput) => Promise<IpcResult<Note>>
        listByEpisode: (input: EpisodeIdInput) => Promise<IpcResult<Note[]>>
        listAll: () => Promise<IpcResult<Note[]>>
        delete: (input: NoteIdInput) => Promise<IpcResult<void>>
        export: () => Promise<IpcResult<{ filePath: string } | null>>
      }
    }
  }
}

export {}
