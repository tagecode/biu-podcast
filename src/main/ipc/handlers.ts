import { app, BrowserWindow, dialog, shell } from 'electron'
import {
  AddSubscriptionInputSchema,
  ChooseDirectoryInputSchema,
  CreateNoteInputSchema,
  CreatePlaylistInputSchema,
  DownloadTaskIdInputSchema,
  DownloadHistoryInputSchema,
  EnqueueDownloadInputSchema,
  EpisodeIdInputSchema,
  GetAdjacentInputSchema,
  GetEpisodeInputSchema,
  ImportBackupInputSchema,
  IPC_CHANNELS,
  ListEpisodesInputSchema,
  MarkAllPlayedInputSchema,
  MarkPlayedInputSchema,
  NoteIdInputSchema,
  OpmlActionInputSchema,
  PlaylistIdInputSchema,
  PlaylistItemInputSchema,
  RefreshSubscriptionInputSchema,
  RemoveSubscriptionInputSchema,
  RenamePlaylistInputSchema,
  ReorderPlaylistInputSchema,
  SetPausedInputSchema,
  SetSettingInputSchema,
  StorageActionInputSchema,
  UpdateActionInputSchema,
  UpdateProgressInputSchema,
  VerifyLocalInputSchema,
  WindowActionInputSchema
} from '@shared/ipc-contract'

import { dataPortabilityService } from '../features/data-portability/data-portability.service'
import { downloadService } from '../features/download/download.service'
import { episodeService } from '../features/episode/episode.service'
import { playbackService } from '../features/playback/playback.service'
import { playlistService } from '../features/playlist/playlist.service'
import { settingsStore } from '../infra/settings/store'
import { updateService } from '../infra/updater'
import { getTrayInstance } from '../infra/tray'
import { installApplicationMenu } from '../infra/menu'
import { storageService } from '../features/storage/storage.service'
import { cleanupService } from '../features/cleanup/cleanup.service'
import { exportDiagnostics } from '../infra/logger'
import { autoRefreshScheduler } from '../features/subscription/auto-refresh'
import { subscriptionService } from '../features/subscription/subscription.service'
import { getRegisteredShortcuts } from '../infra/shortcuts'
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

  registerVoidHandler(
    IPC_CHANNELS.subscription.setPaused,
    SetPausedInputSchema,
    async (_event, input) => {
      subscriptionService.setPaused(input.podcastId, input.paused)
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
    }
  )

  registerNoInputHandler(IPC_CHANNELS.subscription.refreshAll, () =>
    subscriptionService.refreshAll()
  )

  registerHandler(IPC_CHANNELS.subscription.importOpml, OpmlActionInputSchema, async () =>
    subscriptionService.importOpmlFromFile()
  )

  registerHandler(IPC_CHANNELS.subscription.exportOpml, OpmlActionInputSchema, async () =>
    subscriptionService.exportOpmlToFile()
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

  registerHandler(IPC_CHANNELS.episode.markPlayed, MarkPlayedInputSchema, async (_event, input) => {
    // markPlayed already validates the episode exists and is idempotent
    // (WHERE is_played = false). Return its podcastId so we can broadcast
    // the unread-count refresh without a second lookup.
    const result = episodeService.markPlayedWithPodcast(input.episodeId)
    if (result.changed) {
      broadcast(IPC_CHANNELS.episode.changed, { podcastId: result.podcastId })
      broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
    }
    return { changed: result.changed }
  })

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

  registerNoInputHandler(IPC_CHANNELS.playback.getRegisteredShortcuts, () =>
    getRegisteredShortcuts()
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

  registerHandler(IPC_CHANNELS.download.history, DownloadHistoryInputSchema, (_event, input) =>
    downloadService.listHistory(input.offset, input.limit)
  )

  registerNoInputHandler(IPC_CHANNELS.download.getDir, () => downloadService.getDownloadDirectory())

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

export function registerSettingsHandlers(): void {
  registerNoInputHandler(IPC_CHANNELS.settings.get, () => settingsStore.getAll())

  registerVoidHandler(IPC_CHANNELS.settings.set, SetSettingInputSchema, (_event, input) => {
    settingsStore.set(input.key, input.value as never)
    if (input.key === 'autoRefreshMinutes') {
      autoRefreshScheduler.restart()
    }
    // Language change affects main-process UI (menu / tray) — rebuild them.
    if (input.key === 'language') {
      installApplicationMenu()
      getTrayInstance()?.rebuild()
    }
  })

  registerHandler(IPC_CHANNELS.settings.chooseDirectory, ChooseDirectoryInputSchema, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择下载目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  registerHandler(IPC_CHANNELS.settings.openDirectory, ChooseDirectoryInputSchema, async () => {
    const dir = downloadService.getDownloadDirectory()
    await shell.openPath(dir)
  })
}

export function registerPlaylistHandlers(): void {
  registerHandler(IPC_CHANNELS.playlist.create, CreatePlaylistInputSchema, (_e, input) =>
    playlistService.createPlaylist(input.name)
  )
  registerNoInputHandler(IPC_CHANNELS.playlist.list, () => playlistService.listPlaylists())
  registerVoidHandler(IPC_CHANNELS.playlist.rename, RenamePlaylistInputSchema, (_e, input) =>
    playlistService.renamePlaylist(input.playlistId, input.name)
  )
  registerVoidHandler(IPC_CHANNELS.playlist.delete, PlaylistIdInputSchema, (_e, input) =>
    playlistService.deletePlaylist(input.playlistId)
  )
  registerVoidHandler(IPC_CHANNELS.playlist.addItem, PlaylistItemInputSchema, (_e, input) =>
    playlistService.addToPlaylist(input.playlistId, input.episodeId)
  )
  registerVoidHandler(IPC_CHANNELS.playlist.removeItem, PlaylistItemInputSchema, (_e, input) =>
    playlistService.removeFromPlaylist(input.playlistId, input.episodeId)
  )
  registerHandler(IPC_CHANNELS.playlist.listItems, PlaylistIdInputSchema, (_e, input) =>
    playlistService.listPlaylistItems(input.playlistId)
  )
  registerVoidHandler(IPC_CHANNELS.playlist.reorder, ReorderPlaylistInputSchema, (_e, input) =>
    playlistService.reorderPlaylist(input.playlistId, input.episodeIds)
  )
}

export function registerNoteHandlers(): void {
  registerHandler(IPC_CHANNELS.note.create, CreateNoteInputSchema, (_e, input) =>
    playlistService.createNote(input.episodeId, input.timestampSec, input.content)
  )
  registerHandler(IPC_CHANNELS.note.listByEpisode, EpisodeIdInputSchema, (_e, input) =>
    playlistService.listNotesByEpisode(input.episodeId)
  )
  registerNoInputHandler(IPC_CHANNELS.note.listAll, () => playlistService.listAllNotes())
  registerVoidHandler(IPC_CHANNELS.note.delete, NoteIdInputSchema, (_e, input) =>
    playlistService.deleteNote(input.noteId)
  )
  registerHandler(IPC_CHANNELS.note.export, OpmlActionInputSchema, () =>
    playlistService.exportNotesToFile()
  )
}

export function registerAppHandlers(): void {
  registerNoInputHandler(IPC_CHANNELS.app.getInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    productName: '博播 BiuPodcast',
    homepage: 'https://github.com/tagecode/biu-podcast',
    isPackaged: app.isPackaged
  }))
}

export function registerUpdateHandlers(): void {
  registerVoidHandler(IPC_CHANNELS.update.check, UpdateActionInputSchema, () => {
    updateService.check()
  })
  registerVoidHandler(IPC_CHANNELS.update.download, UpdateActionInputSchema, () => {
    updateService.download()
  })
  registerVoidHandler(IPC_CHANNELS.update.install, UpdateActionInputSchema, () => {
    updateService.install()
  })
  registerNoInputHandler(IPC_CHANNELS.update.getStatus, () => updateService.getStatus())
}

export function registerStorageHandlers(): void {
  registerNoInputHandler(IPC_CHANNELS.storage.usage, () => storageService.computeUsage())
  registerNoInputHandler(IPC_CHANNELS.storage.cleanupPreview, () => storageService.previewCleanup())
  registerHandler(IPC_CHANNELS.storage.cleanupRun, StorageActionInputSchema, async () =>
    storageService.runCleanup()
  )
  registerVoidHandler(IPC_CHANNELS.cleanup.clearCache, StorageActionInputSchema, async () => {
    await cleanupService.clearCache()
  })
  registerVoidHandler(IPC_CHANNELS.cleanup.clearAllData, StorageActionInputSchema, async () => {
    await cleanupService.clearAllData()
  })
  registerHandler(IPC_CHANNELS.diagnostics.export, StorageActionInputSchema, async () =>
    exportDiagnostics()
  )
}

export function registerAllHandlers(): void {
  registerSubscriptionHandlers()
  registerEpisodeHandlers()
  registerPlaybackHandlers()
  registerDownloadHandlers()
  registerDataPortabilityHandlers()
  registerSettingsHandlers()
  registerPlaylistHandlers()
  registerNoteHandlers()
  registerWindowHandlers()
  registerAppHandlers()
  registerUpdateHandlers()
  registerStorageHandlers()
}
