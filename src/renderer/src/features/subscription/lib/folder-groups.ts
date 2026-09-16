import type { ContextMenuItem } from '@shared/ipc-contract'
import type { Folder, Podcast } from '@shared/types'

export type FolderFilter = 'all' | 'uncategorized' | string

/** Native context menus are capped at 24 items (`ShowContextMenuInputSchema`). */
export const FOLDER_MOVE_MENU_MAX = 24

export interface PodcastFolderGroup {
  key: string
  folderId: string | null
  name: string | null
  podcasts: Podcast[]
}

export function groupPodcastsByFolder(
  podcasts: Podcast[],
  folders: Folder[],
  filter: FolderFilter,
  hideEmpty = false
): PodcastFolderGroup[] {
  const byId = new Map<string, Podcast[]>()
  const uncategorized: Podcast[] = []
  for (const podcast of podcasts) {
    if (podcast.folderId) {
      const list = byId.get(podcast.folderId) ?? []
      list.push(podcast)
      byId.set(podcast.folderId, list)
    } else {
      uncategorized.push(podcast)
    }
  }

  const folderGroups: PodcastFolderGroup[] = folders.map((folder) => ({
    key: folder.id,
    folderId: folder.id,
    name: folder.name,
    podcasts: byId.get(folder.id) ?? []
  }))

  const uncategorizedGroup: PodcastFolderGroup = {
    key: 'uncategorized',
    folderId: null,
    name: null,
    podcasts: uncategorized
  }

  let groups: PodcastFolderGroup[]
  if (filter === 'uncategorized') {
    groups = [uncategorizedGroup]
  } else if (filter !== 'all') {
    groups = folderGroups.filter((group) => group.folderId === filter)
  } else if (uncategorized.length > 0) {
    groups = [...folderGroups, uncategorizedGroup]
  } else {
    groups = folderGroups
  }

  if (hideEmpty) {
    return groups.filter((group) => group.podcasts.length > 0)
  }
  return groups
}

export function folderMoveMenuItems(
  folders: Folder[],
  labels: { uncategorized: string; newFolder: string; pickFolder: string }
): ContextMenuItem[] {
  const listed: ContextMenuItem[] = [
    ...folders.map((folder) => ({ id: `folder:${folder.id}`, label: folder.name })),
    { id: 'uncategorized', label: labels.uncategorized },
    { id: 'newFolder', label: labels.newFolder }
  ]
  if (listed.length > FOLDER_MOVE_MENU_MAX) {
    return [{ id: 'pickFolder', label: labels.pickFolder }]
  }
  return listed
}
