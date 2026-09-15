import type { ContextMenuItem } from '@shared/ipc-contract'

export async function showContextMenu(
  items: ContextMenuItem[],
  event?: { clientX: number; clientY: number }
): Promise<string | null> {
  const result = await window.api.contextMenu.show({
    items,
    x: event ? Math.round(event.clientX) : undefined,
    y: event ? Math.round(event.clientY) : undefined
  })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export function isEditableContextTarget(
  target: EventTarget | null
): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}
