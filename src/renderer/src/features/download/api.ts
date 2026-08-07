import type { DownloadTask } from '@shared/types'

export async function listDownloads(): Promise<DownloadTask[]> {
  const result = await window.api.download.list()
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function listDownloadHistory(): Promise<DownloadTask[]> {
  const result = await window.api.download.history()
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function enqueueDownload(episodeId: string): Promise<DownloadTask> {
  const result = await window.api.download.enqueue({ episodeId })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function pauseDownload(taskId: string): Promise<void> {
  const result = await window.api.download.pause({ taskId })
  if (!result.ok) throw new Error(result.error.message)
}

export async function resumeDownload(taskId: string): Promise<void> {
  const result = await window.api.download.resume({ taskId })
  if (!result.ok) throw new Error(result.error.message)
}

export async function cancelDownload(taskId: string): Promise<void> {
  const result = await window.api.download.cancel({ taskId })
  if (!result.ok) throw new Error(result.error.message)
}
