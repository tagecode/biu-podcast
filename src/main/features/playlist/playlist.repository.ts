import { asc, desc, eq, sql } from 'drizzle-orm'
import { ulid } from 'ulid'

import type { AppDatabase } from '../../infra/db/client'
import { episodes, playlistItems, playlists, podcasts } from '../../infra/db/schema'
import type { Playlist, PlaylistItem } from '@shared/types'

export class PlaylistRepository {
  constructor(private readonly db: AppDatabase) {}

  create(name: string): Playlist {
    const id = ulid()
    const createdAt = Date.now()
    this.db.insert(playlists).values({ id, name, createdAt }).run()
    return { id, name, createdAt, itemCount: 0 }
  }

  list(): Playlist[] {
    const rows = this.db
      .select({
        playlist: playlists,
        itemCount: sql<number>`count(${playlistItems.id})`
      })
      .from(playlists)
      .leftJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
      .groupBy(playlists.id)
      .orderBy(desc(playlists.createdAt))
      .all()
    return rows.map(({ playlist, itemCount }) => ({
      ...this.toPlaylist(playlist),
      itemCount: Number(itemCount ?? 0)
    }))
  }

  findById(id: string): Playlist | null {
    const row = this.db.select().from(playlists).where(eq(playlists.id, id)).get()
    return row ? this.toPlaylist(row) : null
  }

  rename(id: string, name: string): void {
    this.db.update(playlists).set({ name }).where(eq(playlists.id, id)).run()
  }

  delete(id: string): void {
    this.db.delete(playlists).where(eq(playlists.id, id)).run()
  }

  addItem(playlistId: string, episodeId: string): void {
    const playlist = this.findById(playlistId)
    if (!playlist) throw new Error('播放列表不存在')
    // Re-adding an episode is a no-op (same episode once per playlist).
    const existing = this.db
      .select({ id: playlistItems.id })
      .from(playlistItems)
      .where(
        sql`${playlistItems.playlistId} = ${playlistId} AND ${playlistItems.episodeId} = ${episodeId}`
      )
      .get()
    if (existing) return

    const maxOrder = this.db
      .select({ value: sql<number>`coalesce(max(${playlistItems.sortOrder}), -1)` })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId))
      .get()
    const sortOrder = Number(maxOrder?.value ?? -1) + 1

    this.db
      .insert(playlistItems)
      .values({ id: ulid(), playlistId, episodeId, sortOrder, addedAt: Date.now() })
      .run()
  }

  removeItem(playlistId: string, episodeId: string): void {
    this.db
      .delete(playlistItems)
      .where(
        sql`${playlistItems.playlistId} = ${playlistId} AND ${playlistItems.episodeId} = ${episodeId}`
      )
      .run()
  }

  listItems(playlistId: string): PlaylistItem[] {
    const rows = this.db
      .select({
        item: playlistItems,
        episodeTitle: episodes.title,
        podcastTitle: podcasts.title
      })
      .from(playlistItems)
      .innerJoin(episodes, eq(episodes.id, playlistItems.episodeId))
      .innerJoin(podcasts, eq(podcasts.id, episodes.podcastId))
      .where(eq(playlistItems.playlistId, playlistId))
      .orderBy(asc(playlistItems.sortOrder))
      .all()
    return rows.map(({ item, episodeTitle, podcastTitle }) => ({
      ...this.toItem(item),
      episodeTitle,
      podcastTitle
    }))
  }

  reorder(playlistId: string, episodeIds: string[]): void {
    const tx = this.db
    tx.transaction(() => {
      episodeIds.forEach((episodeId, index) => {
        tx.update(playlistItems)
          .set({ sortOrder: index })
          .where(
            sql`${playlistItems.playlistId} = ${playlistId} AND ${playlistItems.episodeId} = ${episodeId}`
          )
          .run()
      })
    })
  }

  private toPlaylist(row: typeof playlists.$inferSelect): Playlist {
    return { id: row.id, name: row.name, createdAt: row.createdAt }
  }

  private toItem(row: typeof playlistItems.$inferSelect): PlaylistItem {
    return {
      id: row.id,
      playlistId: row.playlistId,
      episodeId: row.episodeId,
      sortOrder: row.sortOrder,
      addedAt: row.addedAt
    }
  }
}
