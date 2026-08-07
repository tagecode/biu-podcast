import { dialog } from 'electron'
import { writeFile } from 'fs/promises'

import { getDb, type AppDatabase } from '../../infra/db/client'
import { AppError } from '@shared/errors'
import type { Note, Playlist, PlaylistItem } from '@shared/types'

import { PlaylistRepository } from './playlist.repository'
import { NoteRepository } from './note.repository'

export interface PlaylistServiceDeps {
  db?: AppDatabase
}

export class PlaylistService {
  private readonly playlists: PlaylistRepository
  private readonly notes: NoteRepository

  constructor(deps: PlaylistServiceDeps = {}) {
    const db = deps.db ?? getDb()
    this.playlists = new PlaylistRepository(db)
    this.notes = new NoteRepository(db)
  }

  // --- Playlists ---

  createPlaylist(name: string): Playlist {
    return this.playlists.create(name.trim() || '未命名播放列表')
  }

  listPlaylists(): Playlist[] {
    return this.playlists.list()
  }

  renamePlaylist(id: string, name: string): void {
    if (!this.playlists.findById(id)) {
      throw new AppError('NOT_FOUND', '播放列表不存在')
    }
    this.playlists.rename(id, name.trim() || '未命名播放列表')
  }

  deletePlaylist(id: string): void {
    if (!this.playlists.findById(id)) {
      throw new AppError('NOT_FOUND', '播放列表不存在')
    }
    this.playlists.delete(id)
  }

  addToPlaylist(playlistId: string, episodeId: string): void {
    if (!this.playlists.findById(playlistId)) {
      throw new AppError('NOT_FOUND', '播放列表不存在')
    }
    this.playlists.addItem(playlistId, episodeId)
  }

  removeFromPlaylist(playlistId: string, episodeId: string): void {
    this.playlists.removeItem(playlistId, episodeId)
  }

  listPlaylistItems(playlistId: string): PlaylistItem[] {
    return this.playlists.listItems(playlistId)
  }

  reorderPlaylist(playlistId: string, episodeIds: string[]): void {
    this.playlists.reorder(playlistId, episodeIds)
  }

  // --- Notes ---

  createNote(episodeId: string, timestampSec: number, content: string): Note {
    return this.notes.create(episodeId, Math.max(0, Math.round(timestampSec)), content.trim())
  }

  listNotesByEpisode(episodeId: string): Note[] {
    return this.notes.listByEpisode(episodeId)
  }

  listAllNotes(): Note[] {
    return this.notes.listAll()
  }

  deleteNote(id: string): void {
    this.notes.delete(id)
  }

  /** Export all notes as a Markdown file via the save dialog. */
  async exportNotesToFile(): Promise<{ filePath: string } | null> {
    const result = await dialog.showSaveDialog({
      title: '导出笔记',
      defaultPath: 'biu-podcast-notes.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return null

    const all = this.notes.listAll()
    const md = ['# 博播笔记', '']
    for (const note of all) {
      const title = note.episodeTitle ?? note.episodeId
      const ts = formatTimestamp(note.timestampSec)
      md.push(`## ${title} · ${ts}`)
      md.push('')
      md.push(note.content)
      md.push('')
    }
    await writeFile(result.filePath, md.join('\n'), 'utf8')
    return { filePath: result.filePath }
  }
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export const playlistService = new PlaylistService()
