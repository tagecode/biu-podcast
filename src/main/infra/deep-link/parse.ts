import { AppError } from '@shared/errors'

export type DeepLinkAction =
  { type: 'open' } | { type: 'subscribe'; feedUrl: string } | { type: 'play'; episodeId: string }

/**
 * Parse a `biu-podcast://` deep link into an action.
 * Validates inputs so malformed / malicious URLs are rejected before they
 * reach any handler.
 */
export function parseDeepLink(rawUrl: string): DeepLinkAction {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new AppError('INVALID_DEEPLINK', '无效的深链接')
  }

  if (url.protocol !== 'biu-podcast:') {
    throw new AppError('INVALID_DEEPLINK', '不是博播深链接')
  }

  const host = url.hostname.toLowerCase()
  if (!host || host === 'open' || host === 'app') {
    return { type: 'open' }
  }

  if (host === 'subscribe') {
    const feedUrl = url.searchParams.get('url') ?? ''
    if (!feedUrl || !/^https?:\/\//.test(feedUrl)) {
      throw new AppError('INVALID_DEEPLINK', '订阅深链接缺少有效的 RSS 地址')
    }
    return { type: 'subscribe', feedUrl }
  }

  if (host === 'play') {
    const episodeId = url.pathname.replace(/^\//, '').trim()
    if (!episodeId) {
      throw new AppError('INVALID_DEEPLINK', '播放深链接缺少集数 ID')
    }
    return { type: 'play', episodeId }
  }

  throw new AppError('INVALID_DEEPLINK', `未知的深链接操作: ${host}`)
}

/**
 * Extract a deep link from the app's startup argv (Windows/Linux) or a
 * second-instance invocation. Returns null when none is present.
 */
export function findDeepLinkInArgs(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith('biu-podcast://')) return arg
  }
  return null
}
