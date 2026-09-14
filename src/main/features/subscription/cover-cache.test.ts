import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

import { CoverCache } from './cover-cache'

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
])

function makeFetch(init: {
  ok?: boolean
  type?: string
  body?: Buffer
  status?: number
}): typeof fetch {
  return vi.fn(async () => {
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? (init.type ?? null) : null)
      },
      arrayBuffer: async () =>
        (init.body ?? PNG).buffer.slice(
          (init.body ?? PNG).byteOffset,
          (init.body ?? PNG).byteOffset + (init.body ?? PNG).byteLength
        )
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('CoverCache', () => {
  it('writes an image next to the podcast id and returns the local path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'biu-covers-'))
    const cache = new CoverCache({ dir, fetchFn: makeFetch({ type: 'image/png' }) })

    const path = await cache.cache('pod-1', 'https://example.com/cover.png')

    expect(path).toBe(join(dir, 'pod-1.png'))
    expect(existsSync(path!)).toBe(true)
    expect(readFileSync(path!).equals(PNG)).toBe(true)
    expect(cache.localPath('pod-1')).toBe(path)
  })

  it('keeps a previously cached file when the download fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'biu-covers-'))
    const existing = join(dir, 'pod-1.jpg')
    mkdirSync(dir, { recursive: true })
    writeFileSync(existing, 'old')
    const cache = new CoverCache({
      dir,
      fetchFn: makeFetch({ ok: false, status: 404, type: 'text/html', body: Buffer.from('nope') })
    })

    const path = await cache.cache('pod-1', 'https://example.com/gone.png')
    expect(path).toBe(existing)
    expect(readFileSync(existing, 'utf8')).toBe('old')
  })

  it('rejects non-image responses and oversized payloads', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'biu-covers-'))
    const htmlCache = new CoverCache({
      dir,
      fetchFn: makeFetch({ type: 'text/html', body: Buffer.from('<html></html>') })
    })
    expect(await htmlCache.cache('pod-html', 'https://example.com/index.html')).toBeNull()

    const huge = Buffer.alloc(5 * 1024 * 1024 + 1, 1)
    const hugeCache = new CoverCache({
      dir,
      fetchFn: makeFetch({ type: 'image/jpeg', body: huge })
    })
    expect(await hugeCache.cache('pod-huge', 'https://example.com/huge.jpg')).toBeNull()
  })

  it('returns null for a blank url or a podcast with no cached file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'biu-covers-'))
    const cache = new CoverCache({ dir, fetchFn: makeFetch({ type: 'image/png' }) })
    expect(await cache.cache('pod-x', null)).toBeNull()
    expect(cache.localPath('missing')).toBeNull()
  })

  it('clear removes cached files; remove deletes one podcast cover', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'biu-covers-'))
    const cache = new CoverCache({ dir, fetchFn: makeFetch({ type: 'image/jpeg' }) })
    const path = await cache.cache('pod-1', 'https://example.com/a.jpg')
    expect(existsSync(path!)).toBe(true)

    await cache.remove('pod-1')
    expect(cache.localPath('pod-1')).toBeNull()

    await cache.cache('pod-2', 'https://example.com/b.jpg')
    await cache.clear()
    expect(existsSync(dir)).toBe(false)
  })
})
