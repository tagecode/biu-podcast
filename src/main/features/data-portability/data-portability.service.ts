import { app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import JSZip from 'jszip'
import { eq } from 'drizzle-orm'

import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  type BackupBundle,
  type BackupData,
  type ImportPreview,
  type ImportStrategy
} from '@shared/backup'
import { AppError } from '@shared/errors'
import type { AppSettings } from '@shared/types'

import { getDb } from '../../infra/db/client'
import { downloadTasks, episodes, podcasts } from '../../infra/db/schema'
import { settingsStore } from '../../infra/settings/store'
import { previewImport } from './preview'

function collectBackupData(): BackupData {
  const db = getDb()
  const podcastRows = db.select().from(podcasts).all()
  const episodeRows = db.select().from(episodes).all()
  const taskRows = db.select().from(downloadTasks).all()
  const settings = settingsStore.getAll()

  return {
    podcasts: podcastRows.map((row) => ({
      id: row.id,
      feedUrl: row.feedUrl,
      title: row.title,
      description: row.description,
      coverUrl: row.coverUrl,
      author: row.author,
      language: row.language,
      isPaused: row.isPaused,
      unsubscribedAt: row.unsubscribedAt,
      subscribedAt: row.subscribedAt,
      lastFetchedAt: row.lastFetchedAt,
      lastFetchStatus: row.lastFetchStatus
    })),
    episodes: episodeRows.map((row) => ({
      id: row.id,
      podcastId: row.podcastId,
      guid: row.guid,
      title: row.title,
      descriptionHtml: row.descriptionHtml,
      publishedAt: row.publishedAt,
      audioUrl: row.audioUrl,
      durationSec: row.durationSec,
      fileSizeBytes: row.fileSizeBytes,
      isPlayed: row.isPlayed,
      playbackPositionSec: row.playbackPositionSec,
      isDownloaded: row.isDownloaded,
      localFilePath: row.localFilePath,
      downloadStatus: row.downloadStatus,
      downloadedAt: row.downloadedAt
    })),
    downloadTasks: taskRows.map((row) => ({
      id: row.id,
      episodeId: row.episodeId,
      status: row.status,
      progressBytes: row.progressBytes,
      totalBytes: row.totalBytes,
      retryCount: row.retryCount,
      updatedAt: row.updatedAt
    })),
    settings
  }
}

async function packBackup(bundle: BackupBundle): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(bundle.manifest, null, 2))
  zip.file('data.json', JSON.stringify(bundle.data, null, 2))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

async function unpackBackup(buffer: Buffer): Promise<BackupBundle> {
  const zip = await JSZip.loadAsync(buffer)
  const manifestFile = zip.file('manifest.json')
  const dataFile = zip.file('data.json')
  if (!manifestFile || !dataFile) {
    throw new AppError('INVALID_BACKUP', '备份文件缺少 manifest.json 或 data.json')
  }

  let manifest: BackupBundle['manifest']
  let data: BackupData
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as BackupBundle['manifest']
    data = JSON.parse(await dataFile.async('string')) as BackupData
  } catch {
    throw new AppError('INVALID_BACKUP', '备份文件内容损坏，无法解析')
  }

  if (manifest.app !== BACKUP_APP_ID) {
    throw new AppError('INVALID_BACKUP', '不是有效的博播备份文件')
  }
  if (manifest.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new AppError('UNSUPPORTED_BACKUP', '备份来自更新版本，请先升级应用')
  }
  if (!data?.podcasts || !data?.episodes || !data?.downloadTasks || !data?.settings) {
    throw new AppError('INVALID_BACKUP', '备份数据字段不完整')
  }

  return { manifest, data }
}

function localIdSets(): {
  podcastIds: Set<string>
  episodeIds: Set<string>
  downloadTaskIds: Set<string>
} {
  const db = getDb()
  return {
    podcastIds: new Set(
      db
        .select({ id: podcasts.id })
        .from(podcasts)
        .all()
        .map((row) => row.id)
    ),
    episodeIds: new Set(
      db
        .select({ id: episodes.id })
        .from(episodes)
        .all()
        .map((row) => row.id)
    ),
    downloadTaskIds: new Set(
      db
        .select({ id: downloadTasks.id })
        .from(downloadTasks)
        .all()
        .map((row) => row.id)
    )
  }
}

export class DataPortabilityService {
  async exportToFile(): Promise<{ filePath: string } | null> {
    const defaultName = `biu-podcast-backup-${new Date().toISOString().slice(0, 10)}.biubackup`
    const result = await dialog.showSaveDialog({
      title: '导出全部数据',
      defaultPath: defaultName,
      filters: [{ name: 'BiuPodcast Backup', extensions: ['biubackup'] }]
    })
    if (result.canceled || !result.filePath) return null

    const bundle: BackupBundle = {
      manifest: {
        app: BACKUP_APP_ID,
        appVersion: app.getVersion(),
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: Date.now()
      },
      data: collectBackupData()
    }

    const buffer = await packBackup(bundle)
    await writeFile(result.filePath, buffer)
    return { filePath: result.filePath }
  }

  async previewFromFile(): Promise<{ filePath: string; preview: ImportPreview } | null> {
    const result = await dialog.showOpenDialog({
      title: '导入数据',
      properties: ['openFile'],
      filters: [{ name: 'BiuPodcast Backup', extensions: ['biubackup'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null

    const filePath = result.filePaths[0]
    const buffer = await readFile(filePath)
    const bundle = await unpackBackup(buffer)
    const preview = previewImport(bundle.data, localIdSets())
    return { filePath, preview }
  }

  async importFromFile(filePath: string, strategy: ImportStrategy): Promise<ImportPreview> {
    const buffer = await readFile(filePath)
    const bundle = await unpackBackup(buffer)
    const local = localIdSets()
    const preview = previewImport(bundle.data, local)
    const db = getDb()

    db.transaction((tx) => {
      for (const podcast of bundle.data.podcasts) {
        const exists = local.podcastIds.has(podcast.id)
        if (exists && strategy === 'skip') continue
        if (exists) {
          tx.update(podcasts)
            .set({
              feedUrl: podcast.feedUrl,
              title: podcast.title,
              description: podcast.description,
              coverUrl: podcast.coverUrl,
              author: podcast.author,
              language: podcast.language,
              isPaused: podcast.isPaused,
              unsubscribedAt: podcast.unsubscribedAt,
              subscribedAt: podcast.subscribedAt,
              lastFetchedAt: podcast.lastFetchedAt,
              lastFetchStatus: podcast.lastFetchStatus
            })
            .where(eq(podcasts.id, podcast.id))
            .run()
        } else {
          tx.insert(podcasts).values(podcast).run()
        }
      }

      for (const episode of bundle.data.episodes) {
        const exists = local.episodeIds.has(episode.id)
        if (exists && strategy === 'skip') continue
        if (exists) {
          tx.update(episodes)
            .set({
              podcastId: episode.podcastId,
              guid: episode.guid,
              title: episode.title,
              descriptionHtml: episode.descriptionHtml,
              publishedAt: episode.publishedAt,
              audioUrl: episode.audioUrl,
              durationSec: episode.durationSec,
              fileSizeBytes: episode.fileSizeBytes,
              isPlayed: episode.isPlayed,
              playbackPositionSec: episode.playbackPositionSec,
              isDownloaded: episode.isDownloaded,
              localFilePath: episode.localFilePath,
              downloadStatus: episode.downloadStatus,
              downloadedAt: episode.downloadedAt
            })
            .where(eq(episodes.id, episode.id))
            .run()
        } else {
          tx.insert(episodes).values(episode).run()
        }
      }

      for (const task of bundle.data.downloadTasks) {
        const exists = local.downloadTaskIds.has(task.id)
        if (exists && strategy === 'skip') continue
        if (exists) {
          tx.update(downloadTasks)
            .set({
              episodeId: task.episodeId,
              status: task.status,
              progressBytes: task.progressBytes,
              totalBytes: task.totalBytes,
              retryCount: task.retryCount,
              updatedAt: task.updatedAt
            })
            .where(eq(downloadTasks.id, task.id))
            .run()
        } else {
          tx.insert(downloadTasks).values(task).run()
        }
      }
    })

    const settings = bundle.data.settings as AppSettings
    settingsStore.set('downloadPath', settings.downloadPath)
    settingsStore.set('resumeOnLaunch', settings.resumeOnLaunch)
    settingsStore.set('lastEpisodeId', settings.lastEpisodeId)
    settingsStore.set('lastPodcastId', settings.lastPodcastId)
    settingsStore.set('lastPositionSec', settings.lastPositionSec)

    return preview
  }
}

export const dataPortabilityService = new DataPortabilityService()
