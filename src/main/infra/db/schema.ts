import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const podcasts = sqliteTable('podcasts', {
  id: text('id').primaryKey(),
  feedUrl: text('feed_url').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  author: text('author'),
  language: text('language'),
  isPaused: integer('is_paused', { mode: 'boolean' }).notNull().default(false),
  unsubscribedAt: integer('unsubscribed_at'),
  subscribedAt: integer('subscribed_at').notNull(),
  lastFetchedAt: integer('last_fetched_at'),
  lastFetchStatus: text('last_fetch_status')
})

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  podcastId: text('podcast_id')
    .notNull()
    .references(() => podcasts.id, { onDelete: 'cascade' }),
  guid: text('guid'),
  title: text('title').notNull(),
  descriptionHtml: text('description_html'),
  publishedAt: integer('published_at').notNull(),
  audioUrl: text('audio_url').notNull(),
  durationSec: integer('duration_sec'),
  fileSizeBytes: integer('file_size_bytes'),
  isPlayed: integer('is_played', { mode: 'boolean' }).notNull().default(false),
  playbackPositionSec: real('playback_position_sec').notNull().default(0),
  isDownloaded: integer('is_downloaded', { mode: 'boolean' }).notNull().default(false),
  localFilePath: text('local_file_path'),
  downloadStatus: text('download_status'),
  downloadedAt: integer('downloaded_at')
})

export const downloadTasks = sqliteTable('download_tasks', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  progressBytes: integer('progress_bytes').notNull().default(0),
  totalBytes: integer('total_bytes'),
  retryCount: integer('retry_count').notNull().default(0),
  updatedAt: integer('updated_at').notNull()
})

export const playlists = sqliteTable('playlists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull()
})

export const playlistItems = sqliteTable('playlist_items', {
  id: text('id').primaryKey(),
  playlistId: text('playlist_id')
    .notNull()
    .references(() => playlists.id, { onDelete: 'cascade' }),
  episodeId: text('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  addedAt: integer('added_at').notNull()
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  timestampSec: integer('timestamp_sec').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull()
})
