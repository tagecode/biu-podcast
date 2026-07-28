import { z } from 'zod'

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
  podcastId: z.string().min(1)
})

export const MarkAllPlayedInputSchema = z.object({
  podcastId: z.string().min(1)
})

export const UpdateProgressInputSchema = z.object({
  episodeId: z.string().min(1),
  positionSec: z.number().min(0)
})

export const EnqueueDownloadInputSchema = z.object({
  episodeId: z.string().min(1)
})

export type AddSubscriptionInput = z.infer<typeof AddSubscriptionInputSchema>
export type RemoveSubscriptionInput = z.infer<typeof RemoveSubscriptionInputSchema>
export type RefreshSubscriptionInput = z.infer<typeof RefreshSubscriptionInputSchema>
export type ListEpisodesInput = z.infer<typeof ListEpisodesInputSchema>
export type MarkAllPlayedInput = z.infer<typeof MarkAllPlayedInputSchema>
export type UpdateProgressInput = z.infer<typeof UpdateProgressInputSchema>
export type EnqueueDownloadInput = z.infer<typeof EnqueueDownloadInputSchema>

export const IPC_CHANNELS = {
  subscription: {
    add: 'subscription:add',
    list: 'subscription:list',
    remove: 'subscription:remove',
    refresh: 'subscription:refresh',
    changed: 'subscription:changed'
  },
  episode: {
    listByPodcast: 'episode:list-by-podcast',
    markAllPlayed: 'episode:mark-all-played',
    changed: 'episode:changed'
  },
  playback: {
    updateProgress: 'playback:update-progress',
    getLastSession: 'playback:get-last-session'
  },
  download: {
    enqueue: 'download:enqueue',
    list: 'download:list',
    pause: 'download:pause',
    resume: 'download:resume',
    cancel: 'download:cancel',
    progress: 'download:progress'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  }
} as const
