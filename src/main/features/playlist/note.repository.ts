import { desc, eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import type { AppDatabase } from '../../infra/db/client'
import { episodes, notes } from '../../infra/db/schema'
import type { Note } from '@shared/types'

export class NoteRepository {
  constructor(private readonly db: AppDatabase) {}

  create(episodeId: string, timestampSec: number, content: string): Note {
    const id = ulid()
    const createdAt = Date.now()
    this.db.insert(notes).values({ id, episodeId, timestampSec, content, createdAt }).run()
    return { id, episodeId, timestampSec, content, createdAt }
  }

  listByEpisode(episodeId: string): Note[] {
    const rows = this.db
      .select({ note: notes, episodeTitle: episodes.title })
      .from(notes)
      .innerJoin(episodes, eq(episodes.id, notes.episodeId))
      .where(eq(notes.episodeId, episodeId))
      .orderBy(desc(notes.createdAt))
      .all()
    return rows.map(({ note, episodeTitle }) => ({ ...this.toNote(note), episodeTitle }))
  }

  listAll(): Note[] {
    const rows = this.db
      .select({ note: notes, episodeTitle: episodes.title })
      .from(notes)
      .innerJoin(episodes, eq(episodes.id, notes.episodeId))
      .orderBy(desc(notes.createdAt))
      .all()
    return rows.map(({ note, episodeTitle }) => ({ ...this.toNote(note), episodeTitle }))
  }

  delete(id: string): void {
    this.db.delete(notes).where(eq(notes.id, id)).run()
  }

  private toNote(row: typeof notes.$inferSelect): Note {
    return {
      id: row.id,
      episodeId: row.episodeId,
      timestampSec: row.timestampSec,
      content: row.content,
      createdAt: row.createdAt
    }
  }
}
