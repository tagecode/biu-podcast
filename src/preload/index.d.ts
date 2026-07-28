import type {
  AddSubscriptionInput,
  EnqueueDownloadInput,
  ListEpisodesInput,
  MarkAllPlayedInput,
  RefreshSubscriptionInput,
  RemoveSubscriptionInput,
  UpdateProgressInput
} from '@shared/ipc-contract'
import type { EpisodeListPage } from '@shared/episode-list'
import type { AppSettings, DownloadTask, IpcResult, Podcast } from '@shared/types'

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
        onChanged: (callback: (podcasts: Podcast[]) => void) => () => void
      }
      episode: {
        listByPodcast: (input: ListEpisodesInput) => Promise<IpcResult<EpisodeListPage>>
        markAllPlayed: (input: MarkAllPlayedInput) => Promise<IpcResult<{ updated: number }>>
        onChanged: (callback: (payload: { podcastId: string }) => void) => () => void
      }
      playback: {
        updateProgress: (input: UpdateProgressInput) => Promise<IpcResult<void>>
      }
      download: {
        enqueue: (input: EnqueueDownloadInput) => Promise<IpcResult<void>>
        list: () => Promise<IpcResult<DownloadTask[]>>
      }
      settings: {
        get: () => Promise<IpcResult<AppSettings>>
      }
    }
  }
}

export {}
