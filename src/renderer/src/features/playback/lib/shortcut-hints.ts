import type { RegisteredShortcuts } from '@shared/ipc-contract'

// Kept as a re-export for the playback feature's tooltips; the canonical
// implementation lives in the shared lib so other features (settings) can use
// it without crossing the feature boundary.
export { formatAccelerator } from '@/lib/accelerator'

/** Fetch the accelerators actually registered for each playback command. */
export async function fetchRegisteredShortcuts(): Promise<RegisteredShortcuts> {
  const result = await window.api.playback.getRegisteredShortcuts()
  return result.ok ? result.data : {}
}
