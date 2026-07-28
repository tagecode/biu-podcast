import {
  AddSubscriptionInputSchema,
  IPC_CHANNELS,
  ListEpisodesInputSchema,
  MarkAllPlayedInputSchema,
  RefreshSubscriptionInputSchema,
  RemoveSubscriptionInputSchema,
  UpdateProgressInputSchema
} from '@shared/ipc-contract'

import { episodeService } from '../features/episode/episode.service'
import { subscriptionService } from '../features/subscription/subscription.service'
import { broadcast, registerHandler, registerNoInputHandler, registerVoidHandler } from './register'

export function registerSubscriptionHandlers(): void {
  registerHandler(
    IPC_CHANNELS.subscription.add,
    AddSubscriptionInputSchema,
    async (_event, input) => {
      const podcast = await subscriptionService.add(input.feedUrl)
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
      return podcast
    }
  )

  registerNoInputHandler(IPC_CHANNELS.subscription.list, () => subscriptionService.list())

  registerVoidHandler(
    IPC_CHANNELS.subscription.remove,
    RemoveSubscriptionInputSchema,
    async (_event, input) => {
      subscriptionService.remove(input.podcastId, input.deleteData)
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
    }
  )

  registerHandler(
    IPC_CHANNELS.subscription.refresh,
    RefreshSubscriptionInputSchema,
    async (_event, input) => {
      const result = await subscriptionService.refresh(input.podcastId)
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
      broadcast(IPC_CHANNELS.episode.changed, { podcastId: input.podcastId })
      return result
    }
  )
}

export function registerEpisodeHandlers(): void {
  registerHandler(
    IPC_CHANNELS.episode.listByPodcast,
    ListEpisodesInputSchema,
    async (_event, input) => {
      return episodeService.listByPodcast(input.podcastId, input.offset, input.limit)
    }
  )

  registerHandler(
    IPC_CHANNELS.episode.markAllPlayed,
    MarkAllPlayedInputSchema,
    async (_event, input) => {
      const updated = episodeService.markAllPlayed(input.podcastId)
      broadcast(IPC_CHANNELS.episode.changed, { podcastId: input.podcastId })
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
      return { updated }
    }
  )

  registerVoidHandler(
    IPC_CHANNELS.playback.updateProgress,
    UpdateProgressInputSchema,
    async (_event, input) => {
      episodeService.updateProgress(input.episodeId, input.positionSec)
    }
  )
}

export function registerAllHandlers(): void {
  registerSubscriptionHandlers()
  registerEpisodeHandlers()
}
