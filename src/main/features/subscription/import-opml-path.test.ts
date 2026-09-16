import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionService } from './subscription.service'
import { createTestDb } from '../../test-utils/db'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'biu-opml-'))
})
afterEach(async () => rm(dir, { recursive: true, force: true }))

describe('importOpmlFromPath', () => {
  it('rejects non-OPML files before reading', async () => {
    const { db } = createTestDb()
    const service = new SubscriptionService({ db })
    await expect(service.importOpmlFromPath(join(dir, 'notes.txt'))).rejects.toThrow(
      '仅支持导入 .opml 或 .xml 文件'
    )
  })

  it('imports a valid dropped OPML file', async () => {
    const filePath = join(dir, 'feeds.opml')
    await writeFile(
      filePath,
      `<?xml version="1.0"?><opml version="2.0"><body><outline text="A" xmlUrl="https://example.com/a.xml" /></body></opml>`
    )
    const { db } = createTestDb()
    const service = new SubscriptionService({ db })
    vi.spyOn(service, 'add').mockResolvedValue({ id: 'p1' } as never)
    await expect(service.importOpmlFromPath(filePath)).resolves.toMatchObject({
      added: 1,
      skipped: 0,
      failed: []
    })
  })
})

describe('previewOpmlFromPath', () => {
  it('parses without inserting subscriptions', async () => {
    const filePath = join(dir, 'feeds.opml')
    await writeFile(
      filePath,
      `<?xml version="1.0"?><opml version="2.0"><body><outline text="技术"><outline text="A" xmlUrl="https://example.com/a.xml" /></outline></body></opml>`
    )
    const { db } = createTestDb()
    const service = new SubscriptionService({ db })
    const add = vi.spyOn(service, 'add').mockResolvedValue({ id: 'p1' } as never)
    const preview = await service.previewOpmlFromPath(filePath)
    expect(preview.items).toEqual([
      { title: 'A', feedUrl: 'https://example.com/a.xml', folderName: '技术' }
    ])
    expect(add).not.toHaveBeenCalled()
    expect(service.list()).toEqual([])
  })
})
