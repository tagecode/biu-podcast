import { Notification } from 'electron'

/** Centralized system-notification helper (P1-14/P1-26). */
export function showNotification(options: { title: string; body: string }, enabled = true): void {
  if (!enabled) return
  if (!Notification.isSupported()) return
  new Notification({ title: options.title, body: options.body }).show()
}
