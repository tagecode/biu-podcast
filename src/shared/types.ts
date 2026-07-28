export type FetchStatus =
  'ok' | 'timeout' | 'parse_error' | 'invalid_xml' | 'not_found' | 'network_error'

export type DownloadTaskStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed'

export interface Podcast {
  id: string
  feedUrl: string
  title: string
  description: string | null
  coverUrl: string | null
  author: string | null
  language: string | null
  isPaused: boolean
  subscribedAt: number
  lastFetchedAt: number | null
  lastFetchStatus: FetchStatus | null
  unreadCount?: number
}

export interface Episode {
  id: string
  podcastId: string
  title: string
  descriptionHtml: string | null
  publishedAt: number
  audioUrl: string
  durationSec: number | null
  fileSizeBytes: number | null
  isPlayed: boolean
  playbackPositionSec: number
  isDownloaded: boolean
  localFilePath: string | null
  downloadStatus: DownloadTaskStatus | null
  downloadedAt: number | null
  guid?: string | null
}

export interface DownloadTask {
  id: string
  episodeId: string
  status: DownloadTaskStatus
  progressBytes: number
  totalBytes: number | null
  retryCount: number
  updatedAt: number
  episodeTitle?: string
  podcastTitle?: string
}

export interface ParsedFeedEpisode {
  title: string
  descriptionHtml: string | null
  publishedAt: number
  audioUrl: string
  durationSec: number | null
  fileSizeBytes: number | null
  guid: string | null
}

export interface ParsedFeed {
  title: string
  description: string | null
  coverUrl: string | null
  author: string | null
  language: string | null
  episodes: ParsedFeedEpisode[]
}

export interface IpcError {
  code: string
  message: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export interface AppSettings {
  downloadPath: string | null
  resumeOnLaunch: boolean
}

export type AppRoute = 'subscriptions' | 'detail' | 'player' | 'settings'
