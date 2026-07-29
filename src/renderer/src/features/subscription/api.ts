import type { IpcResult, Podcast } from '@shared/types'

export async function listSubscriptions(): Promise<Podcast[]> {
  const result = await window.api.subscription.list()
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function addSubscription(feedUrl: string): Promise<Podcast> {
  const result = await window.api.subscription.add({ feedUrl })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export async function refreshSubscription(podcastId: string): Promise<void> {
  const result = await window.api.subscription.refresh({ podcastId })
  if (!result.ok) throw new Error(result.error.message)
}

export async function removeSubscription(podcastId: string, deleteData = false): Promise<void> {
  const result = await window.api.subscription.remove({ podcastId, deleteData })
  if (!result.ok) throw new Error(result.error.message)
}

export function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
