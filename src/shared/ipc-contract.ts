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

export const ListEpisodesInputSchema = z.object({
  podcastId: z.string().min(1),
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(100).optional().default(50)
})

export const MarkAllPlayedInputSchema = z.object({
  podcastId: z.string().min(1)
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

export type AddSubscriptionInput = z.infer<typeof AddSubscriptionInputSchema>
export type RemoveSubscriptionInput = z.infer<typeof RemoveSubscriptionInputSchema>
export type RefreshSubscriptionInput = z.infer<typeof RefreshSubscriptionInputSchema>
export type ListEpisodesInput = z.infer<typeof ListEpisodesInputSchema>
export type MarkAllPlayedInput = z.infer<typeof MarkAllPlayedInputSchema>
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
