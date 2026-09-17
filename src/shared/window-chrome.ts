/**
 * Native macOS traffic-light cluster under `titleBarStyle: 'hiddenInset'`.
 * The custom header is h-12 (48px); buttons are ~12px, so y=18 centers them.
 */
export const MACOS_TRAFFIC_LIGHT_POSITION = { x: 16, y: 18 } as const

/**
 * CSS padding-left (px) that clears the traffic lights plus a 12px gap.
 * Cluster ends at x + 3×12 + 2×8 = 68px.
 */
export const MACOS_TRAFFIC_LIGHT_INSET_PX = 80
