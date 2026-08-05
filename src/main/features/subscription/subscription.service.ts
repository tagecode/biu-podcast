import { ulid } from 'ulid'
import { join } from 'path'
import { rm } from 'fs/promises'
import { app } from 'electron'

import { EpisodeRepository } from '../episode/episode.repository'
import { getDb, type AppDatabase } from '../../infra/db/client'
import { settingsStore, SettingsStore } from '../../infra/settings/store'
import { AppError } from '@shared/errors'
import type { FetchStatus, Podcast } from '@shared/types'

import { fetchAndParseFeed } from './feed-parser'
import { normalizeFeedUrl, SubscriptionRepository } from './subscription.repository'

export interface SubscriptionServiceDeps {
  db?: AppDatabase
  settings?: SettingsStore
}

function getDownloadDir(settings: SettingsStore): string {
  const configured = settings.getAll().downloadPath
  if (configured) return configured
  return join(app.getPath('userData'), 'downloads')
}

export class SubscriptionService {
  private readonly db: AppDatabase
  private readonly settings: SettingsStore
  private readonly subscriptions: SubscriptionRepository
  private readonly episodes: EpisodeRepository

  constructor(deps: SubscriptionServiceDeps = {}) {
    this.db = deps.db ?? getDb()
    this.settings = deps.settings ?? settingsStore
    this.subscriptions = new SubscriptionRepository(this.db)
    this.episodes = new EpisodeRepository(this.db)
  }

  async add(feedUrl: string): Promise<Podcast> {
    const existing = this.subscriptions.findByFeedUrl(feedUrl)
    if (existing) {
      throw new AppError('ALREADY_SUBSCRIBED', '该播客已订阅，无需重复添加')
    }

    const parsed = await fetchAndParseFeed(feedUrl)
    const now = Date.now()

    // A previously soft-unsubscribed record may still hold the feed_url (kept
    // because the user chose "保留数据"). Re-activate it instead of inserting,
    // which would trip the feed_url UNIQUE constraint.
    const softDeleted = this.subscriptions.findAnyByFeedUrl(feedUrl)
    if (softDeleted) {
      this.subscriptions.reactivatePodcast(softDeleted.id, {
        title: parsed.title,
        description: parsed.description,
        coverUrl: parsed.coverUrl,
        author: parsed.author,
        language: parsed.language,
        lastFetchedAt: now,
        lastFetchStatus: 'ok'
      })
      this.episodes.insertMany(softDeleted.id, parsed.episodes)
      return {
        ...softDeleted,
        title: parsed.title,
        description: parsed.description,
        coverUrl: parsed.coverUrl,
        author: parsed.author,
        language: parsed.language,
        isPaused: false,
        subscribedAt: softDeleted.subscribedAt,
        lastFetchedAt: now,
        lastFetchStatus: 'ok',
        unreadCount: this.episodes.countUnread(softDeleted.id),
        playedCount: this.episodes.countPlayed(softDeleted.id)
      }
    }

    const podcast: Podcast = {
      id: ulid(),
      feedUrl: normalizeFeedUrl(feedUrl),
      title: parsed.title,
      description: parsed.description,
      coverUrl: parsed.coverUrl,
      author: parsed.author,
      language: parsed.language,
      isPaused: false,
      subscribedAt: now,
      lastFetchedAt: now,
      lastFetchStatus: 'ok'
    }

    this.subscriptions.insertPodcast({
      id: podcast.id,
      feedUrl: podcast.feedUrl,
      title: podcast.title,
      description: podcast.description,
      coverUrl: podcast.coverUrl,
      author: podcast.author,
      language: podcast.language,
      subscribedAt: now,
      lastFetchedAt: now,
      lastFetchStatus: 'ok'
    })
    this.episodes.insertMany(podcast.id, parsed.episodes)

    return { ...podcast, unreadCount: parsed.episodes.length, playedCount: 0 }
  }

  list(): Podcast[] {
    return this.subscriptions.listWithUnreadCount()
  }

  async refresh(podcastId: string): Promise<{ addedCount: number; podcast: Podcast }> {
    const podcast = this.subscriptions.findById(podcastId)
    if (!podcast) {
      throw new AppError('NOT_FOUND', '播客不存在')
    }

    try {
      const parsed = await fetchAndParseFeed(podcast.feedUrl)
      const now = Date.now()
      this.subscriptions.updatePodcastMeta(podcastId, {
        title: parsed.title,
        description: parsed.description,
        coverUrl: parsed.coverUrl,
        author: parsed.author,
        language: parsed.language,
        lastFetchedAt: now,
        lastFetchStatus: 'ok'
      })
      const addedCount = this.episodes.insertMany(podcastId, parsed.episodes)
      const updated = this.subscriptions.findById(podcastId)
      if (!updated) throw new AppError('NOT_FOUND', '播客不存在')
      return {
        addedCount,
        podcast: {
          ...updated,
          unreadCount: this.episodes.countUnread(podcastId),
          playedCount: this.episodes.countPlayed(podcastId)
        }
      }
    } catch (error) {
      const status: FetchStatus =
        error instanceof AppError
          ? error.code === 'TIMEOUT'
            ? 'timeout'
            : error.code === 'NOT_FOUND'
              ? 'not_found'
              : error.code === 'PARSE_ERROR'
                ? 'parse_error'
                : 'network_error'
          : 'network_error'
      this.subscriptions.updatePodcastMeta(podcastId, {
        title: podcast.title,
        description: podcast.description,
        coverUrl: podcast.coverUrl,
        author: podcast.author,
        language: podcast.language,
        lastFetchedAt: Date.now(),
        lastFetchStatus: status
      })
      throw error
    }
  }

  async remove(podcastId: string, deleteData: boolean): Promise<void> {
    const podcast = this.subscriptions.findById(podcastId)
    if (!podcast) {
      throw new AppError('NOT_FOUND', '播客不存在')
    }
    if (deleteData) {
      const localPaths = this.episodes.listLocalFilePaths(podcastId)
      this.subscriptions.deletePodcast(podcastId)
      for (const filePath of localPaths) {
        await rm(filePath, { force: true })
        await rm(`${filePath}.part`, { force: true })
      }
      await rm(join(getDownloadDir(this.settings), podcastId), { recursive: true, force: true })
    } else {
      this.subscriptions.softUnsubscribe(podcastId)
    }
  }
}

export const subscriptionService = new SubscriptionService()
