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
  /** Number of episodes marked as played (dynamically computed with unreadCount). */
  playedCount?: number
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

export interface Playlist {
  id: string
  name: string
  createdAt: number
  /** Episode count (computed on list). */
  itemCount?: number
}

export interface PlaylistItem {
  id: string
  playlistId: string
  episodeId: string
  sortOrder: number
  addedAt: number
  episodeTitle?: string
  podcastTitle?: string
}

export interface Note {
  id: string
  episodeId: string
  timestampSec: number
  content: string
  createdAt: number
  episodeTitle?: string
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
  lastEpisodeId: string | null
  lastPodcastId: string | null
  lastPositionSec: number
  /** Auto-refresh interval in minutes; null/0 = manual. */
  autoRefreshMinutes: number | null
}

export interface PlaybackSession {
  episode: Episode
  podcast: Podcast
  positionSec: number
}

export type AppRoute = 'subscriptions' | 'detail' | 'player' | 'settings'
