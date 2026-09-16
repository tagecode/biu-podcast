import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import { AppError } from '@shared/errors'
import type { Folder } from '@shared/types'

import type { AppDatabase } from '../../infra/db/client'
import { folders, podcasts } from '../../infra/db/schema'
import { FOLDER_NAME_MAX } from './opml'

function normalizeName(name: string): string {
  return name.trim().slice(0, FOLDER_NAME_MAX)
}

export class FolderRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): Folder[] {
    return this.db
      .select()
      .from(folders)
      .all()
      .map((row) => this.toFolder(row))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  findById(id: string): Folder | null {
    const row = this.db.select().from(folders).where(eq(folders.id, id)).get()
    return row ? this.toFolder(row) : null
  }

  findByName(name: string): Folder | null {
    const normalized = normalizeName(name)
    const row = this.db
      .select()
      .from(folders)
      .all()
      .find((item) => item.name === normalized)
    return row ? this.toFolder(row) : null
  }

  create(name: string): Folder {
    const normalized = normalizeName(name)
    if (!normalized) {
      throw new AppError('INVALID_INPUT', '分类名不能为空')
    }
    if (this.findByName(normalized)) {
      throw new AppError('INVALID_INPUT', '已有同名分类')
    }
    const folder: Folder = { id: ulid(), name: normalized, createdAt: Date.now() }
    this.db.insert(folders).values(folder).run()
    return folder
  }

  rename(id: string, name: string): Folder {
    const existing = this.findById(id)
    if (!existing) throw new AppError('NOT_FOUND', '分类不存在')
    const normalized = normalizeName(name)
    if (!normalized) throw new AppError('INVALID_INPUT', '分类名不能为空')
    const clash = this.findByName(normalized)
    if (clash && clash.id !== id) throw new AppError('INVALID_INPUT', '已有同名分类')
    this.db.update(folders).set({ name: normalized }).where(eq(folders.id, id)).run()
    return { ...existing, name: normalized }
  }

  delete(id: string): void {
    if (!this.findById(id)) throw new AppError('NOT_FOUND', '分类不存在')
    this.db.update(podcasts).set({ folderId: null }).where(eq(podcasts.folderId, id)).run()
    this.db.delete(folders).where(eq(folders.id, id)).run()
  }

  ensureByName(name: string): Folder {
    const existing = this.findByName(name)
    if (existing) return existing
    return this.create(name)
  }

  setPodcastFolder(podcastId: string, folderId: string | null): void {
    if (folderId && !this.findById(folderId)) {
      throw new AppError('NOT_FOUND', '分类不存在')
    }
    this.db.update(podcasts).set({ folderId }).where(eq(podcasts.id, podcastId)).run()
  }

  private toFolder(row: typeof folders.$inferSelect): Folder {
    return { id: row.id, name: row.name, createdAt: row.createdAt }
  }
}
