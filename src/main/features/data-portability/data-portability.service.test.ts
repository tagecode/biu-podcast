import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'

process.env.BIU_PODCAST_DB_PATH = ':memory:'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/fake-userdata', getVersion: () => '2.0.0' },
  dialog: {
    showSaveDialog: vi.fn(async () => ({ canceled: true })),
    showOpenDialog: vi.fn(async () => ({ canceled: true }))
  }
}))

import { createTestDb, createTestSettings } from '../../test-utils/db'
import { DataPortabilityService } from './data-portability.service'
import * as schema from '../../infra/db/schema'
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, type BackupBundle } from '@shared/backup'
import { dialog } from 'electron'

async function writeBackup(bundle: BackupBundle): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'biu-bkp-'))
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(bundle.manifest, null, 2))
  zip.file('data.json', JSON.stringify(bundle.data, null, 2))
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const filePath = join(dir, 'backup.biubackup')
  writeFileSync(filePath, buffer)
  return filePath
}

function makeBundle(): BackupBundle {
  return {
    manifest: {
      app: BACKUP_APP_ID,
      appVersion: '2.0.0',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1700000000000
    },
    data: {
      podcasts: [
        {
          id: 'p1',
          feedUrl: 'https://example.com/feed.xml',
          title: 'Imported Podcast',
          description: 'desc',
          coverUrl: null,
          author: 'Author',
          language: 'en',
          isPaused: false,
          unsubscribedAt: null,
          subscribedAt: 1700000000000,
          lastFetchedAt: 1700000000000,
          lastFetchStatus: 'ok'
        }
      ],
      episodes: [
        {
          id: 'e1',
          podcastId: 'p1',
          guid: 'guid-1',
          title: 'Imported EP',
          descriptionHtml: '<p>hi</p>',
          publishedAt: 1700000000000,
          audioUrl: 'https://example.com/ep1.mp3',
          durationSec: 600,
          fileSizeBytes: 1024,
          isPlayed: false,
          playbackPositionSec: 0,
          isDownloaded: false,
          localFilePath: null,
          downloadStatus: null,
          downloadedAt: null
        }
      ],
      downloadTasks: [],
      settings: {
        downloadPath: null,
        resumeOnLaunch: true,
        lastEpisodeId: null,
        lastPodcastId: null,
        lastPositionSec: 0
      }
    }
  }
}

describe('DataPortabilityService', () => {
  it('importFromFile with skip strategy imports new data', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new DataPortabilityService({ db, settings })
    const filePath = await writeBackup(makeBundle())

    const preview = await service.importFromFile(filePath, 'skip')
    expect(preview.podcastsAdded).toBe(1)
    expect(preview.episodesAdded).toBe(1)

    const podcasts = db.select().from(schema.podcasts).all()
    expect(podcasts).toHaveLength(1)
    expect(podcasts[0]?.title).toBe('Imported Podcast')
    expect(db.select().from(schema.episodes).all()).toHaveLength(1)
  })

  it('importFromFile overwrite strategy replaces existing', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    // pre-insert a podcast with same id but different title
    db.insert(schema.podcasts)
      .values({
        id: 'p1',
        feedUrl: 'https://example.com/old.xml',
        title: 'Old Title',
        description: null,
        coverUrl: null,
        author: null,
        language: null,
        isPaused: false,
        subscribedAt: 1700000000000,
        lastFetchedAt: null,
        lastFetchStatus: null
      })
      .run()
    const service = new DataPortabilityService({ db, settings })
    const filePath = await writeBackup(makeBundle())

    const preview = await service.importFromFile(filePath, 'overwrite')
    expect(preview.podcastsConflict).toBe(1)

    const after = db.select().from(schema.podcasts).all()
    expect(after[0]?.title).toBe('Imported Podcast')
    expect(after[0]?.feedUrl).toBe('https://example.com/feed.xml')
  })

  it('importFromFile skip strategy keeps existing on conflict', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    db.insert(schema.podcasts)
      .values({
        id: 'p1',
        feedUrl: 'https://example.com/old.xml',
        title: 'Old Title',
        description: null,
        coverUrl: null,
        author: null,
        language: null,
        isPaused: false,
        subscribedAt: 1700000000000,
        lastFetchedAt: null,
        lastFetchStatus: null
      })
      .run()
    const service = new DataPortabilityService({ db, settings })
    const filePath = await writeBackup(makeBundle())

    await service.importFromFile(filePath, 'skip')
    const after = db.select().from(schema.podcasts).all()
    expect(after[0]?.title).toBe('Old Title')
  })

  it('importFromFile rejects invalid backup', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new DataPortabilityService({ db, settings })
    const dir = mkdtempSync(join(tmpdir(), 'biu-bad-'))
    const badPath = join(dir, 'bad.biubackup')
    writeFileSync(badPath, 'not a zip')

    await expect(service.importFromFile(badPath, 'skip')).rejects.toThrow('备份文件')
  })

  it('importFromFile writes settings back', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new DataPortabilityService({ db, settings })
    const bundle = makeBundle()
    bundle.data.settings = {
      downloadPath: '/custom/downloads',
      resumeOnLaunch: false,
      lastEpisodeId: 'e1',
      lastPodcastId: 'p1',
      lastPositionSec: 45
    }
    const filePath = await writeBackup(bundle)

    await service.importFromFile(filePath, 'skip')
    expect(settings.getAll().downloadPath).toBe('/custom/downloads')
    expect(settings.getAll().resumeOnLaunch).toBe(false)
    expect(settings.getAll().lastPositionSec).toBe(45)
  })

  it('exportToFile writes a valid backup file', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new DataPortabilityService({ db, settings })
    // seed one podcast + episode
    db.insert(schema.podcasts)
      .values({
        id: 'p1',
        feedUrl: 'https://example.com/feed.xml',
        title: 'Pod',
        description: null,
        coverUrl: null,
        author: null,
        language: null,
        isPaused: false,
        subscribedAt: 1700000000000,
        lastFetchedAt: null,
        lastFetchStatus: null
      })
      .run()

    const outPath = join(mkdtempSync(join(tmpdir(), 'biu-exp-')), 'out.biubackup')
    const mockedSave = dialog.showSaveDialog as ReturnType<typeof vi.fn>
    mockedSave.mockResolvedValueOnce({ canceled: false, filePath: outPath })

    const result = await service.exportToFile()
    expect(result?.filePath).toBe(outPath)
    // verify the written file is a valid backup by importing it back
    const fresh = createTestDb()
    const freshService = new DataPortabilityService({
      db: fresh.db,
      settings: createTestSettings()
    })
    const preview = await freshService.importFromFile(outPath, 'skip')
    expect(preview.podcastsAdded).toBe(1)
    fresh.sqlite.close()
  })

  it('exportToFile returns null when canceled', async () => {
    const { db } = createTestDb()
    const service = new DataPortabilityService({ db, settings: createTestSettings() })
    const mockedSave = dialog.showSaveDialog as ReturnType<typeof vi.fn>
    mockedSave.mockResolvedValueOnce({ canceled: true, filePath: undefined })
    expect(await service.exportToFile()).toBeNull()
  })

  it('previewFromFile returns preview for a real backup', async () => {
    const { db } = createTestDb()
    const service = new DataPortabilityService({ db, settings: createTestSettings() })
    const filePath = await writeBackup(makeBundle())
    const mockedOpen = dialog.showOpenDialog as ReturnType<typeof vi.fn>
    mockedOpen.mockResolvedValueOnce({ canceled: false, filePaths: [filePath] })

    const result = await service.previewFromFile()
    expect(result?.filePath).toBe(filePath)
    expect(result?.preview.podcastsAdded).toBe(1)
    expect(result?.preview.episodesAdded).toBe(1)
  })

  it('previewFromFile returns null when canceled', async () => {
    const { db } = createTestDb()
    const service = new DataPortabilityService({ db, settings: createTestSettings() })
    const mockedOpen = dialog.showOpenDialog as ReturnType<typeof vi.fn>
    mockedOpen.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await service.previewFromFile()).toBeNull()
  })

  it('export → import roundtrip preserves full data (episodes + tasks + settings)', async () => {
    const { db } = createTestDb()
    const settings = createTestSettings()
    const service = new DataPortabilityService({ db, settings })

    // seed a podcast + episode + download task
    db.insert(schema.podcasts)
      .values({
        id: 'p1',
        feedUrl: 'https://example.com/feed.xml',
        title: 'Pod',
        description: 'desc',
        coverUrl: null,
        author: 'A',
        language: 'en',
        isPaused: false,
        subscribedAt: 1700000000000,
        lastFetchedAt: 1700000000000,
        lastFetchStatus: 'ok'
      })
      .run()
    db.insert(schema.episodes)
      .values({
        id: 'e1',
        podcastId: 'p1',
        guid: 'g1',
        title: 'EP1',
        descriptionHtml: null,
        publishedAt: 1700000000000,
        audioUrl: 'https://x.com/e1.mp3',
        durationSec: 600,
        fileSizeBytes: 1024,
        isPlayed: true,
        playbackPositionSec: 45,
        isDownloaded: true,
        localFilePath: '/tmp/e1.mp3',
        downloadStatus: 'completed',
        downloadedAt: 1700000000000
      })
      .run()
    db.insert(schema.downloadTasks)
      .values({
        id: 't1',
        episodeId: 'e1',
        status: 'completed',
        progressBytes: 1024,
        totalBytes: 1024,
        retryCount: 0,
        updatedAt: 1700000000000
      })
      .run()
    settings.set('downloadPath', '/custom')

    const outPath = join(mkdtempSync(join(tmpdir(), 'biu-rt-')), 'out.biubackup')
    const mockedSave = dialog.showSaveDialog as ReturnType<typeof vi.fn>
    mockedSave.mockResolvedValueOnce({ canceled: false, filePath: outPath })
    await service.exportToFile()

    // import into a fresh db
    const fresh = createTestDb()
    const freshSettings = createTestSettings()
    const freshService = new DataPortabilityService({ db: fresh.db, settings: freshSettings })
    const preview = await freshService.importFromFile(outPath, 'skip')
    expect(preview.podcastsAdded).toBe(1)
    expect(preview.episodesAdded).toBe(1)
    expect(preview.downloadTasksAdded).toBe(1)

    const ep = fresh.db.select().from(schema.episodes).all()[0]
    expect(ep?.isPlayed).toBe(true)
    expect(ep?.playbackPositionSec).toBe(45)
    expect(freshSettings.getAll().downloadPath).toBe('/custom')
    fresh.sqlite.close()
  })
})
