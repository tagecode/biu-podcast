import { BrowserWindow } from 'electron'
import {
  AddSubscriptionInputSchema,
  DownloadTaskIdInputSchema,
  EnqueueDownloadInputSchema,
  GetAdjacentInputSchema,
  GetEpisodeInputSchema,
  ImportBackupInputSchema,
  IPC_CHANNELS,
  ListEpisodesInputSchema,
  MarkAllPlayedInputSchema,
  RefreshSubscriptionInputSchema,
  RemoveSubscriptionInputSchema,
  UpdateProgressInputSchema,
  VerifyLocalInputSchema,
  WindowActionInputSchema
} from '@shared/ipc-contract'

import { dataPortabilityService } from '../features/data-portability/data-portability.service'
import { downloadService } from '../features/download/download.service'
import { episodeService } from '../features/episode/episode.service'
import { playbackService } from '../features/playback/playback.service'
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
      await subscriptionService.remove(input.podcastId, input.deleteData)
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

  registerHandler(IPC_CHANNELS.episode.getById, GetEpisodeInputSchema, async (_event, input) =>
    episodeService.getById(input.episodeId)
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

  registerHandler(IPC_CHANNELS.episode.getAdjacent, GetAdjacentInputSchema, async (_event, input) =>
    playbackService.getAdjacent(input.episodeId)
  )
}

export function registerPlaybackHandlers(): void {
  registerVoidHandler(
    IPC_CHANNELS.playback.updateProgress,
    UpdateProgressInputSchema,
    async (_event, input) => {
      playbackService.updateProgress(input.episodeId, input.positionSec)
    }
  )

  registerNoInputHandler(IPC_CHANNELS.playback.getLastSession, () =>
    playbackService.getLastSession()
  )
}

export function registerDownloadHandlers(): void {
  registerHandler(
    IPC_CHANNELS.download.enqueue,
    EnqueueDownloadInputSchema,
    async (_event, input) => {
      const task = downloadService.enqueue(input.episodeId)
      return task
    }
  )

  registerNoInputHandler(IPC_CHANNELS.download.list, () => downloadService.list())

  registerVoidHandler(
    IPC_CHANNELS.download.pause,
    DownloadTaskIdInputSchema,
    async (_event, input) => {
      downloadService.pause(input.taskId)
    }
  )

  registerVoidHandler(
    IPC_CHANNELS.download.resume,
    DownloadTaskIdInputSchema,
    async (_event, input) => {
      downloadService.resume(input.taskId)
    }
  )

  registerVoidHandler(
    IPC_CHANNELS.download.cancel,
    DownloadTaskIdInputSchema,
    async (_event, input) => {
      await downloadService.cancel(input.taskId)
    }
  )

  registerHandler(
    IPC_CHANNELS.download.verifyLocal,
    VerifyLocalInputSchema,
    async (_event, input) => downloadService.verifyLocalFile(input.episodeId)
  )
}

export function registerDataPortabilityHandlers(): void {
  registerNoInputHandler(IPC_CHANNELS.dataPortability.export, async () =>
    dataPortabilityService.exportToFile()
  )

  registerNoInputHandler(IPC_CHANNELS.dataPortability.previewImport, async () =>
    dataPortabilityService.previewFromFile()
  )

  registerHandler(
    IPC_CHANNELS.dataPortability.import,
    ImportBackupInputSchema,
    async (_event, input) => {
      const preview = await dataPortabilityService.importFromFile(input.filePath, input.strategy)
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
      return preview
    }
  )
}

export function registerWindowHandlers(): void {
  const windowOf = (event: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  registerVoidHandler(IPC_CHANNELS.window.minimize, WindowActionInputSchema, (event) => {
    windowOf(event)?.minimize()
  })

  registerVoidHandler(IPC_CHANNELS.window.maximize, WindowActionInputSchema, (event) => {
    const win = windowOf(event)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  registerVoidHandler(IPC_CHANNELS.window.close, WindowActionInputSchema, (event) => {
    windowOf(event)?.close()
  })

  registerHandler(
    IPC_CHANNELS.window.isMaximized,
    WindowActionInputSchema,
    (event) => windowOf(event)?.isMaximized() ?? false
  )
}

export function registerAllHandlers(): void {
  registerSubscriptionHandlers()
  registerEpisodeHandlers()
  registerPlaybackHandlers()
  registerDownloadHandlers()
  registerDataPortabilityHandlers()
  registerWindowHandlers()
}
