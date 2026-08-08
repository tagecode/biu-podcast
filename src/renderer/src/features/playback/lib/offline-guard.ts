import i18n from '@/lib/i18n'

export type PlayGuardResult = { ok: true } | { ok: false; message: string }

export function canPlayEpisode(
  episode: { isDownloaded: boolean },
  online: boolean
): PlayGuardResult {
  if (!online && !episode.isDownloaded) {
    return {
      ok: false,
      message: i18n.t('playback.offlineUndownloaded')
    }
  }
  return { ok: true }
}
