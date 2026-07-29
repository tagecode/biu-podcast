import type { Episode } from '@shared/types'

/** Episodes are ordered newest-first. "Next" goes older; "Previous" goes newer. */
export function findAdjacentEpisodes(
  episodes: Episode[],
  currentId: string
): { previous: Episode | null; next: Episode | null } {
  const index = episodes.findIndex((item) => item.id === currentId)
  if (index < 0) return { previous: null, next: null }
  return {
    previous: index > 0 ? episodes[index - 1] : null,
    next: index < episodes.length - 1 ? episodes[index + 1] : null
  }
}
