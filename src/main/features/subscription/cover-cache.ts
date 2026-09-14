import { existsSync } from 'fs'
import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000
const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const

const TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

export interface CoverCacheDeps {
  dir?: string
  fetchFn?: typeof fetch
}

export function getCoversDir(): string {
  return join(app.getPath('userData'), 'covers')
}

function extensionFor(contentType: string | null, url: string): string | null {
  const mime = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (mime in TYPE_TO_EXT) return TYPE_TO_EXT[mime]
  const match = url.toLowerCase().match(/\.(jpe?g|png|webp|gif)(?:\?|$)/)
  if (!match) return null
  return match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`
}

export class CoverCache {
  private readonly explicitDir: string | undefined
  private readonly fetchFn: typeof fetch

  constructor(deps: CoverCacheDeps = {}) {
    this.explicitDir = deps.dir
    this.fetchFn = deps.fetchFn ?? fetch
  }

  private get dir(): string {
    return this.explicitDir ?? getCoversDir()
  }

  localPath(podcastId: string): string | null {
    if (!existsSync(this.dir)) return null
    for (const ext of COVER_EXTENSIONS) {
      const candidate = join(this.dir, `${podcastId}${ext}`)
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  async cache(podcastId: string, remoteUrl: string | null): Promise<string | null> {
    if (!remoteUrl) return this.localPath(podcastId)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const response = await this.fetchFn(remoteUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'BiuPodcast/1.0 (+https://github.com/tagecode/biu-podcast)' }
        })
        if (!response.ok) return this.localPath(podcastId)

        const ext = extensionFor(response.headers.get('content-type'), remoteUrl)
        if (!ext) return this.localPath(podcastId)

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
          return this.localPath(podcastId)
        }

        await mkdir(this.dir, { recursive: true })
        await this.remove(podcastId)
        const dest = join(this.dir, `${podcastId}${ext}`)
        await writeFile(dest, buffer)
        return dest
      } finally {
        clearTimeout(timeout)
      }
    } catch {
      return this.localPath(podcastId)
    }
  }

  async remove(podcastId: string): Promise<void> {
    if (!existsSync(this.dir)) return
    const prefix = `${podcastId}.`
    const entries = await readdir(this.dir)
    await Promise.all(
      entries
        .filter((name) => name.startsWith(prefix) || name === podcastId)
        .map((name) => rm(join(this.dir, name), { force: true }))
    )
  }

  async clear(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true })
  }
}
