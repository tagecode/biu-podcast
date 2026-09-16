import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EpisodeSearchHit, Podcast } from '@shared/types'
import { SubscriptionListView } from './SubscriptionListView'
import { useSubscriptionStore } from '../store'

function makePodcast(overrides: Partial<Podcast> = {}): Podcast {
  return {
    id: 'pod-1',
    feedUrl: 'https://example.com/feed.xml',
    title: '科技早知道',
    description: null,
    coverUrl: null,
    author: null,
    language: null,
    isPaused: false,
    subscribedAt: 1,
    lastFetchedAt: null,
    lastFetchStatus: null,
    unreadCount: 2,
    playedCount: 1,
    ...overrides
  }
}

function makeHit(title: string): EpisodeSearchHit {
  return {
    podcastTitle: '科技早知道',
    episode: {
      id: 'ep-1',
      podcastId: 'pod-1',
      title,
      descriptionHtml: null,
      publishedAt: 1700000000000,
      audioUrl: 'https://example.com/ep.mp3',
      durationSec: 600,
      fileSizeBytes: 1024,
      isPlayed: false,
      playbackPositionSec: 0,
      isDownloaded: true,
      localFilePath: '/tmp/ep.mp3',
      downloadStatus: 'completed',
      downloadedAt: 1700000000000,
      guid: 'g1'
    }
  }
}

describe('SubscriptionListView', () => {
  const refreshAll = vi.fn()
  const list = vi.fn()
  const listFolders = vi.fn()
  const search = vi.fn()
  const refresh = vi.fn()
  const setPaused = vi.fn()
  const remove = vi.fn()
  const showContextMenu = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({ ok: true as const, data: [] })
    listFolders.mockResolvedValue({ ok: true as const, data: [] })
    refreshAll.mockResolvedValue({ ok: true as const, data: [] })
    search.mockResolvedValue({ ok: true as const, data: [] })
    refresh.mockResolvedValue({
      ok: true as const,
      data: { addedCount: 0, podcast: makePodcast() }
    })
    setPaused.mockResolvedValue({ ok: true as const, data: undefined })
    remove.mockResolvedValue({ ok: true as const, data: undefined })
    showContextMenu.mockResolvedValue({ ok: true as const, data: null })
    window.api = {
      subscription: {
        list,
        listFolders,
        refreshAll,
        refresh,
        setPaused,
        remove,
        onChanged: vi.fn(() => () => undefined)
      },
      episode: { search },
      clipboard: { writeText: vi.fn(async () => ({ ok: true as const, data: undefined })) },
      contextMenu: { show: showContextMenu }
    } as unknown as Window['api']
    useSubscriptionStore.setState({
      podcasts: [],
      folders: [],
      loading: false,
      error: null,
      query: '',
      sortKey: 'recent',
      refreshingAll: false,
      lastRefreshAdded: null
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('refreshes every feed instead of only reloading the local list', async () => {
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: '刷新全部' }))

    await waitFor(() => {
      expect(refreshAll).toHaveBeenCalledTimes(1)
    })
  })

  it('lets the user dismiss the refresh result banner', () => {
    useSubscriptionStore.setState({ lastRefreshAdded: 3 })
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    expect(screen.getByText('发现 3 集新内容')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByText('发现 3 集新内容')).not.toBeInTheDocument()
  })

  it('searches local episodes when the query changes', async () => {
    search.mockResolvedValueOnce({ ok: true as const, data: [makeHit('AI 周报')] })
    render(<SubscriptionListView onOpenPodcast={() => undefined} onOpenEpisode={() => undefined} />)

    fireEvent.change(screen.getByPlaceholderText('搜索播客或集数…'), {
      target: { value: 'AI' }
    })

    expect(await screen.findByText('AI 周报')).toBeInTheDocument()
    expect(search).toHaveBeenCalledWith({ query: 'AI', downloadedOnly: false })
  })

  it('refreshes a podcast from the native context menu', async () => {
    showContextMenu.mockResolvedValue({ ok: true as const, data: 'refresh' })
    list.mockResolvedValue({ ok: true as const, data: [makePodcast()] })
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    fireEvent.contextMenu(await screen.findByRole('button', { name: /科技早知道/ }))

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledWith({ podcastId: 'pod-1' })
    })
    expect(showContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          { id: 'open', label: '打开详情' },
          { id: 'refresh', label: '刷新' },
          { id: 'copyLink', label: '复制链接' },
          { id: 'pause', label: '暂停订阅' },
          { id: 'remove', label: '取消订阅', danger: true }
        ])
      })
    )
  })

  it('opens the unsubscribe dialog from the context menu without removing immediately', async () => {
    showContextMenu.mockResolvedValue({ ok: true as const, data: 'remove' })
    list.mockResolvedValue({ ok: true as const, data: [makePodcast()] })
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    fireEvent.contextMenu(await screen.findByRole('button', { name: /科技早知道/ }))

    expect(
      await screen.findByText(
        '确定取消订阅「科技早知道」吗？默认保留本地集数与已下载文件，便于日后重新订阅。'
      )
    ).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it('groups podcasts under folder headers', async () => {
    list.mockResolvedValue({
      ok: true as const,
      data: [
        makePodcast({ id: 'pod-1', title: '科技早知道', folderId: 'f-tech', folderName: '技术' }),
        makePodcast({ id: 'pod-2', title: '新闻早餐', folderId: 'f-news', folderName: '新闻' })
      ]
    })
    listFolders.mockResolvedValue({
      ok: true as const,
      data: [
        { id: 'f-tech', name: '技术', createdAt: 1 },
        { id: 'f-news', name: '新闻', createdAt: 2 }
      ]
    })
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    expect(await screen.findByRole('heading', { name: '技术' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新闻' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /科技早知道/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新闻早餐/ })).toBeInTheDocument()
  })

  it('filters the list to one folder', async () => {
    list.mockResolvedValue({
      ok: true as const,
      data: [
        makePodcast({ id: 'pod-1', title: '科技早知道', folderId: 'f-tech', folderName: '技术' }),
        makePodcast({ id: 'pod-2', title: '新闻早餐', folderId: 'f-news', folderName: '新闻' })
      ]
    })
    listFolders.mockResolvedValue({
      ok: true as const,
      data: [
        { id: 'f-tech', name: '技术', createdAt: 1 },
        { id: 'f-news', name: '新闻', createdAt: 2 }
      ]
    })
    render(<SubscriptionListView onOpenPodcast={() => undefined} />)

    expect(await screen.findByRole('button', { name: /新闻早餐/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('筛选分类'), { target: { value: 'f-tech' } })
    expect(screen.getByRole('button', { name: /科技早知道/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /新闻早餐/ })).not.toBeInTheDocument()
  })
})
