export const BACKUP_SCHEMA_VERSION = 2
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
