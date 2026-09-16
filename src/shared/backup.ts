export const BACKUP_SCHEMA_VERSION = 4
export const BACKUP_APP_ID = 'biu-podcast'
export interface BackupManifest {
  app: string
  appVersion: string
  schemaVersion: number
  exportedAt: number
}

export interface BackupPodcast {
  id: string
  feedUrl: string
  title: string
  description: string | null
  coverUrl: string | null
  author: string | null
  language: string | null
  isPaused: boolean
  unsubscribedAt: number | null
  subscribedAt: number
  lastFetchedAt: number | null
  lastFetchStatus: string | null
  folderId?: string | null
}

export interface BackupFolder {
  id: string
  name: string
  createdAt: number
}

export interface BackupEpisode {
  id: string
  podcastId: string
  guid: string | null
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
  downloadStatus: string | null
  downloadedAt: number | null
}

export interface BackupDownloadTask {
  id: string
  episodeId: string
  status: string
  progressBytes: number
  totalBytes: number | null
  retryCount: number
  updatedAt: number
}

export interface BackupSettings {
  downloadPath: string | null
  resumeOnLaunch: boolean
  lastEpisodeId: string | null
  lastPodcastId: string | null
  lastPositionSec: number
}

export interface BackupData {
  podcasts: BackupPodcast[]
  episodes: BackupEpisode[]
  downloadTasks: BackupDownloadTask[]
  settings: BackupSettings
  /** Persisted playback queue (added in schema 3; optional for old backups). */
  queue?: BackupPlaybackQueue | null
  /** Local folders (added in schema 4; optional for old backups). */
  folders?: BackupFolder[]
}

/** Serialized playback queue for a backup. */
export interface BackupPlaybackQueue {
  episodeIds: string[]
  mode: string
  currentEpisodeId: string | null
}

export interface BackupBundle {
  manifest: BackupManifest
  data: BackupData
}

export type ImportStrategy = 'skip' | 'overwrite'

export interface ImportPreview {
  podcastsAdded: number
  podcastsConflict: number
  episodesAdded: number
  episodesConflict: number
  downloadTasksAdded: number
  downloadTasksConflict: number
}
