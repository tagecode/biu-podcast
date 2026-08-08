import { z } from 'zod'

export { IPC_CHANNELS } from './ipc-channels'

export const AddSubscriptionInputSchema = z.object({
  feedUrl: z.string().trim().min(1, '请输入 RSS Feed 地址').url('请输入有效的 URL 地址')
})

export const RemoveSubscriptionInputSchema = z.object({
  podcastId: z.string().min(1),
  deleteData: z.boolean().default(false)
})

export const RefreshSubscriptionInputSchema = z.object({
  podcastId: z.string().min(1)
})

export const SetPausedInputSchema = z.object({
  podcastId: z.string().min(1),
  paused: z.boolean()
})

/** No payload — dialog-based OPML import/export. */
export const OpmlActionInputSchema = z.object({})

/** Result of an OPML import. */
export interface OpmlImportResult {
  filePath: string
  added: number
  skipped: number
  failed: Array<{ title: string; error: string }>
}

export const ListEpisodesInputSchema = z.object({
  podcastId: z.string().min(1),
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(100).optional().default(50)
})

export const MarkAllPlayedInputSchema = z.object({
  podcastId: z.string().min(1)
})

export const MarkPlayedInputSchema = z.object({
  episodeId: z.string().min(1)
})

export const GetEpisodeInputSchema = z.object({
  episodeId: z.string().min(1)
})

export const UpdateProgressInputSchema = z.object({
  episodeId: z.string().min(1),
  positionSec: z.number().min(0)
})

export const EnqueueDownloadInputSchema = z.object({
  episodeId: z.string().min(1)
})

export const VerifyLocalInputSchema = z.object({
  episodeId: z.string().min(1)
})

export const DownloadHistoryInputSchema = z.object({
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(100).optional().default(50)
})

export type DownloadHistoryInput = z.infer<typeof DownloadHistoryInputSchema>

export type AddSubscriptionInput = z.infer<typeof AddSubscriptionInputSchema>
export type RemoveSubscriptionInput = z.infer<typeof RemoveSubscriptionInputSchema>
export type RefreshSubscriptionInput = z.infer<typeof RefreshSubscriptionInputSchema>
export type SetPausedInput = z.infer<typeof SetPausedInputSchema>
export type OpmlActionInput = z.infer<typeof OpmlActionInputSchema>
export type ListEpisodesInput = z.infer<typeof ListEpisodesInputSchema>
export type MarkAllPlayedInput = z.infer<typeof MarkAllPlayedInputSchema>
export type MarkPlayedInput = z.infer<typeof MarkPlayedInputSchema>
export type GetEpisodeInput = z.infer<typeof GetEpisodeInputSchema>
export type UpdateProgressInput = z.infer<typeof UpdateProgressInputSchema>
export const DownloadTaskIdInputSchema = z.object({
  taskId: z.string().min(1)
})

export const GetAdjacentInputSchema = z.object({
  episodeId: z.string().min(1)
})

export const ImportBackupInputSchema = z.object({
  filePath: z.string().min(1),
  strategy: z.enum(['skip', 'overwrite']).default('skip')
})

export type DownloadTaskIdInput = z.infer<typeof DownloadTaskIdInputSchema>
export type GetAdjacentInput = z.infer<typeof GetAdjacentInputSchema>
export type EnqueueDownloadInput = z.infer<typeof EnqueueDownloadInputSchema>
export type VerifyLocalInput = z.infer<typeof VerifyLocalInputSchema>
export type ImportBackupInput = z.infer<typeof ImportBackupInputSchema>

/** Window controls from the custom title bar (no payload needed). */
export const WindowActionInputSchema = z.object({})
export type WindowActionInput = z.infer<typeof WindowActionInputSchema>

export const SetSettingInputSchema = z.object({
  key: z.enum([
    'autoRefreshMinutes',
    'playbackRate',
    'openFullPlayerDefault',
    'notificationsEnabled',
    'downloadPath',
    'closeToTray',
    'theme',
    'fontScale',
    'language',
    'cleanupRetentionDays',
    'loggingEnabled'
  ]),
  value: z.union([z.number().nullable(), z.string(), z.boolean()])
})
export type SetSettingInput = z.infer<typeof SetSettingInputSchema>

/** No payload — dialog-based directory picker. */
export const ChooseDirectoryInputSchema = z.object({})
export type ChooseDirectoryInput = z.infer<typeof ChooseDirectoryInputSchema>

export const CreatePlaylistInputSchema = z.object({
  name: z.string().min(1).max(100)
})

export const RenamePlaylistInputSchema = z.object({
  playlistId: z.string().min(1),
  name: z.string().min(1).max(100)
})

export const PlaylistIdInputSchema = z.object({
  playlistId: z.string().min(1)
})

export const PlaylistItemInputSchema = z.object({
  playlistId: z.string().min(1),
  episodeId: z.string().min(1)
})

export const ReorderPlaylistInputSchema = z.object({
  playlistId: z.string().min(1),
  episodeIds: z.array(z.string()).max(1000)
})

export const CreateNoteInputSchema = z.object({
  episodeId: z.string().min(1),
  timestampSec: z.number().min(0),
  content: z.string().min(1).max(5000)
})

export const EpisodeIdInputSchema = z.object({
  episodeId: z.string().min(1)
})

export const NoteIdInputSchema = z.object({
  noteId: z.string().min(1)
})

export type CreatePlaylistInput = z.infer<typeof CreatePlaylistInputSchema>
export type RenamePlaylistInput = z.infer<typeof RenamePlaylistInputSchema>
export type PlaylistIdInput = z.infer<typeof PlaylistIdInputSchema>
export type PlaylistItemInput = z.infer<typeof PlaylistItemInputSchema>
export type ReorderPlaylistInput = z.infer<typeof ReorderPlaylistInputSchema>
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>
export type EpisodeIdInput = z.infer<typeof EpisodeIdInputSchema>
export type NoteIdInput = z.infer<typeof NoteIdInputSchema>

/** Playback commands sent main→renderer (global shortcuts / media keys). */
export type PlaybackCommand = 'toggle' | 'next' | 'previous'

/** Maps a playback command to the accelerator actually registered (for UI display). */
export type RegisteredShortcuts = Partial<Record<PlaybackCommand, string>>

/** App metadata surfaced for the About page. */
export interface AppInfo {
  name: string
  version: string
  /** Product name used for display (e.g. "博播"). */
  productName: string
  homepage: string
  /** true when packaged (installed), false in dev. */
  isPackaged: boolean
}

/** Update lifecycle phases surfaced to the settings UI. */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled'

export interface UpdateStatus {
  phase: UpdatePhase
  version?: string
  percent?: number
  message?: string
}

/** No payload — update actions are stateful. */
export const UpdateActionInputSchema = z.object({})
export type UpdateActionInput = z.infer<typeof UpdateActionInputSchema>

/** Per-podcast download size usage. */
export interface PodcastStorageUsage {
  podcastId: string
  podcastTitle: string
  bytes: number
  downloadedCount: number
}

export interface StorageUsage {
  podcasts: PodcastStorageUsage[]
  totalBytes: number
}

export interface CleanupPreviewItem {
  episodeId: string
  podcastTitle: string
  episodeTitle: string
  bytes: number
}

export interface CleanupPreview {
  items: CleanupPreviewItem[]
  totalBytes: number
}

export interface CleanupResult {
  freedBytes: number
  removedCount: number
}

/** No payload — storage queries/actions are stateful. */
export const StorageActionInputSchema = z.object({})
export type StorageActionInput = z.infer<typeof StorageActionInputSchema>
