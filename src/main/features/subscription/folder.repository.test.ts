import { describe, expect, it } from 'vitest'

import { AppError } from '@shared/errors'
import { createTestDb } from '../../test-utils/db'
import * as schema from '../../infra/db/schema'
import { FolderRepository } from './folder.repository'

function insertPodcast(db: ReturnType<typeof createTestDb>['db'], id: string, title: string): void {
  db.insert(schema.podcasts)
    .values({
      id,
      feedUrl: `https://example.com/${id}.xml`,
      title,
      description: null,
      coverUrl: null,
      author: null,
      language: null,
      isPaused: false,
      subscribedAt: 1,
      lastFetchedAt: 1,
      lastFetchStatus: 'ok'
    })
    .run()
}

describe('FolderRepository', () => {
  it('creates, lists, and rejects duplicate names', () => {
    const { db, sqlite } = createTestDb()
    const repo = new FolderRepository(db)
    const folder = repo.create('技术')
    expect(folder.name).toBe('技术')
    expect(repo.list().map((item) => item.name)).toEqual(['技术'])
    expect(() => repo.create('技术')).toThrow(AppError)
    sqlite.close()
  })

  it('renames a folder and ensureByName is idempotent', () => {
    const { db, sqlite } = createTestDb()
    const repo = new FolderRepository(db)
    const created = repo.create('前端')
    const renamed = repo.rename(created.id, '技术 / 前端')
    expect(renamed.name).toBe('技术 / 前端')
    const again = repo.ensureByName('技术 / 前端')
    expect(again.id).toBe(created.id)
    sqlite.close()
  })

  it('delete nulls podcast folder_id and does not delete podcasts', () => {
    const { db, sqlite } = createTestDb()
    insertPodcast(db, 'pod-a', 'Show')
    const repo = new FolderRepository(db)
    const folder = repo.create('新闻')
    repo.setPodcastFolder('pod-a', folder.id)
    const assigned = sqlite.prepare(`SELECT folder_id FROM podcasts WHERE id = 'pod-a'`).get() as {
      folder_id: string | null
    }
    expect(assigned.folder_id).toBe(folder.id)

    repo.delete(folder.id)
    const after = sqlite
      .prepare(`SELECT folder_id, title FROM podcasts WHERE id = 'pod-a'`)
      .get() as { folder_id: string | null; title: string }
    expect(after.folder_id).toBeNull()
    expect(after.title).toBe('Show')
    expect(repo.list()).toEqual([])
    sqlite.close()
  })
})
