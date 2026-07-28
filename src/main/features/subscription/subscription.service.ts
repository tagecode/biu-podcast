import { ulid } from 'ulid'

import { EpisodeRepository } from '../episode/episode.repository'
import { getDb } from '../../infra/db/client'
import { AppError } from '@shared/errors'
import type { FetchStatus, Podcast } from '@shared/types'

import { fetchAndParseFeed } from './feed-parser'
import { normalizeFeedUrl, SubscriptionRepository } from './subscription.repository'

export class SubscriptionService {
  private readonly db = getDb()
  private readonly subscriptions = new SubscriptionRepository(this.db)
  private readonly episodes = new EpisodeRepository(this.db)

  async add(feedUrl: string): Promise<Podcast> {
    const existing = this.subscriptions.findByFeedUrl(feedUrl)
    if (existing) {
      throw new AppError('ALREADY_SUBSCRIBED', '该播客已订阅，无需重复添加')
    }

    const parsed = await fetchAndParseFeed(feedUrl)
    const now = Date.now()
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

    return { ...podcast, unreadCount: parsed.episodes.length }
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
        podcast: { ...updated, unreadCount: this.episodes.countUnread(podcastId) }
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

  remove(podcastId: string, deleteData: boolean): void {
    const podcast = this.subscriptions.findById(podcastId)
    if (!podcast) {
      throw new AppError('NOT_FOUND', '播客不存在')
    }
    if (deleteData) {
      this.subscriptions.deletePodcast(podcastId)
    } else {
      throw new AppError('NOT_IMPLEMENTED', '保留数据的取消订阅将在后续版本支持')
    }
  }
}

export const subscriptionService = new SubscriptionService()
