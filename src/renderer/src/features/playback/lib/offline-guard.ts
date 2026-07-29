export type PlayGuardResult = { ok: true } | { ok: false; message: string }

export function canPlayEpisode(
  episode: { isDownloaded: boolean },
  online: boolean
): PlayGuardResult {
  if (!online && !episode.isDownloaded) {
    return {
      ok: false,
      message: '当前无网络且未下载，请先下载或联网播放'
    }
  }
  return { ok: true }
}
