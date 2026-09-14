export function resolveCoverUrl(podcast: {
  coverUrl: string | null
  coverLocalPath?: string | null
}): string | null {
  if (podcast.coverLocalPath) {
    return `biu-media://local/?path=${encodeURIComponent(podcast.coverLocalPath)}`
  }
  return podcast.coverUrl
}
