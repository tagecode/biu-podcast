import type { ImportPreview } from '@shared/backup'

export function previewImport(
  incoming: {
    podcasts: Array<{ id: string }>
    episodes: Array<{ id: string }>
    downloadTasks: Array<{ id: string }>
  },
  local: {
    podcastIds: Set<string>
    episodeIds: Set<string>
    downloadTaskIds: Set<string>
  }
): ImportPreview {
  let podcastsAdded = 0
  let podcastsConflict = 0
  for (const item of incoming.podcasts) {
    if (local.podcastIds.has(item.id)) podcastsConflict += 1
    else podcastsAdded += 1
  }

  let episodesAdded = 0
  let episodesConflict = 0
  for (const item of incoming.episodes) {
    if (local.episodeIds.has(item.id)) episodesConflict += 1
    else episodesAdded += 1
  }

  let downloadTasksAdded = 0
  let downloadTasksConflict = 0
  for (const item of incoming.downloadTasks) {
    if (local.downloadTaskIds.has(item.id)) downloadTasksConflict += 1
    else downloadTasksAdded += 1
  }

  return {
    podcastsAdded,
    podcastsConflict,
    episodesAdded,
    episodesConflict,
    downloadTasksAdded,
    downloadTasksConflict
  }
}
