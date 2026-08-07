import type { Note, Playlist, PlaylistItem } from '@shared/types'

export async function listPlaylists(): Promise<Playlist[]> {
  const r = await window.api.playlist.list()
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const r = await window.api.playlist.create({ name })
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function renamePlaylist(playlistId: string, name: string): Promise<void> {
  const r = await window.api.playlist.rename({ playlistId, name })
  if (!r.ok) throw new Error(r.error.message)
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const r = await window.api.playlist.delete({ playlistId })
  if (!r.ok) throw new Error(r.error.message)
}

export async function addToPlaylist(playlistId: string, episodeId: string): Promise<void> {
  const r = await window.api.playlist.addItem({ playlistId, episodeId })
  if (!r.ok) throw new Error(r.error.message)
}

export async function removeFromPlaylist(playlistId: string, episodeId: string): Promise<void> {
  const r = await window.api.playlist.removeItem({ playlistId, episodeId })
  if (!r.ok) throw new Error(r.error.message)
}

export async function listPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  const r = await window.api.playlist.listItems({ playlistId })
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function reorderPlaylist(playlistId: string, episodeIds: string[]): Promise<void> {
  const r = await window.api.playlist.reorder({ playlistId, episodeIds })
  if (!r.ok) throw new Error(r.error.message)
}

// --- Notes ---

export async function listAllNotes(): Promise<Note[]> {
  const r = await window.api.note.listAll()
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function listNotesByEpisode(episodeId: string): Promise<Note[]> {
  const r = await window.api.note.listByEpisode({ episodeId })
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function createNote(
  episodeId: string,
  timestampSec: number,
  content: string
): Promise<Note> {
  const r = await window.api.note.create({ episodeId, timestampSec, content })
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

export async function deleteNote(noteId: string): Promise<void> {
  const r = await window.api.note.delete({ noteId })
  if (!r.ok) throw new Error(r.error.message)
}
