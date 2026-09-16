import { describe, expect, it } from 'vitest'

import type { Folder, Podcast } from '@shared/types'

import { FOLDER_MOVE_MENU_MAX, folderMoveMenuItems, groupPodcastsByFolder } from './folder-groups'

function podcast(overrides: Partial<Podcast> & Pick<Podcast, 'id' | 'title'>): Podcast {
  return {
    feedUrl: `https://example.com/${overrides.id}.xml`,
    description: null,
    coverUrl: null,
    author: null,
    language: null,
    isPaused: false,
    subscribedAt: 1,
    lastFetchedAt: null,
    lastFetchStatus: null,
    ...overrides
  }
}

const folders: Folder[] = [
  { id: 'f-tech', name: '技术', createdAt: 1 },
  { id: 'f-news', name: '新闻', createdAt: 2 }
]

describe('groupPodcastsByFolder', () => {
  it('groups under each folder then uncategorized', () => {
    const groups = groupPodcastsByFolder(
      [
        podcast({ id: 'a', title: 'A', folderId: 'f-tech' }),
        podcast({ id: 'b', title: 'B', folderId: 'f-news' }),
        podcast({ id: 'c', title: 'C', folderId: null })
      ],
      folders,
      'all'
    )
    expect(groups.map((group) => [group.folderId, group.podcasts.map((item) => item.id)])).toEqual([
      ['f-tech', ['a']],
      ['f-news', ['b']],
      [null, ['c']]
    ])
  })

  it('filters to one folder', () => {
    const groups = groupPodcastsByFolder(
      [
        podcast({ id: 'a', title: 'A', folderId: 'f-tech' }),
        podcast({ id: 'b', title: 'B', folderId: 'f-news' })
      ],
      folders,
      'f-tech'
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.folderId).toBe('f-tech')
    expect(groups[0]?.podcasts.map((item) => item.id)).toEqual(['a'])
  })
})

describe('folderMoveMenuItems', () => {
  it('lists folders plus uncategorized and new when within the native menu cap', () => {
    expect(
      folderMoveMenuItems(folders, {
        uncategorized: '未分类',
        newFolder: '新建分类',
        pickFolder: '选择分类…'
      })
    ).toEqual([
      { id: 'folder:f-tech', label: '技术' },
      { id: 'folder:f-news', label: '新闻' },
      { id: 'uncategorized', label: '未分类' },
      { id: 'newFolder', label: '新建分类' }
    ])
  })

  it(`falls back to a picker when items would exceed ${FOLDER_MOVE_MENU_MAX}`, () => {
    const many = Array.from({ length: FOLDER_MOVE_MENU_MAX - 1 }, (_, index) => ({
      id: `f-${index}`,
      name: `分类 ${index}`,
      createdAt: index
    }))
    expect(
      folderMoveMenuItems(many, {
        uncategorized: '未分类',
        newFolder: '新建分类',
        pickFolder: '选择分类…'
      })
    ).toEqual([{ id: 'pickFolder', label: '选择分类…' }])
  })
})
