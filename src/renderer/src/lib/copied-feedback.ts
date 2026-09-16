export const COPIED_MS = 2000

const listeners = new Set<() => void>()

export function notifyCopied(): void {
  for (const listener of listeners) listener()
}

export function subscribeCopied(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
