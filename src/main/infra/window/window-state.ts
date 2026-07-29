export interface SavedWindowState {
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
}

export interface DisplayBounds {
  x: number
  y: number
  width: number
  height: number
}

function isVisibleOnAnyDisplay(state: SavedWindowState, displays: DisplayBounds[]): boolean {
  const centerX = state.x + state.width / 2
  const centerY = state.y + state.height / 2
  return displays.some(
    (display) =>
      centerX >= display.x &&
      centerX <= display.x + display.width &&
      centerY >= display.y &&
      centerY <= display.y + display.height
  )
}

export function resolveWindowBounds(
  saved: SavedWindowState | null | undefined,
  displays: DisplayBounds[],
  defaults: { width: number; height: number }
): SavedWindowState {
  const primary = displays[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }
  const fallback: SavedWindowState = {
    x: Math.round(primary.x + (primary.width - defaults.width) / 2),
    y: Math.round(primary.y + (primary.height - defaults.height) / 2),
    width: defaults.width,
    height: defaults.height,
    isMaximized: false
  }

  if (!saved) return fallback
  if (!isVisibleOnAnyDisplay(saved, displays)) {
    return { ...fallback, isMaximized: saved.isMaximized }
  }
  return saved
}
