import type { AppSettings } from '@shared/types'

/**
 * Apply theme + font-scale preferences to the document root.
 *
 * Theme:
 * - 'dark' → add `.dark` class (activates the CSS variable set in main.css).
 * - 'light' → remove `.dark`.
 * - 'system' → follow `prefers-color-scheme`, and keep reacting to OS changes
 *   while this preference is active.
 *
 * Font scale: sets `font-size` on <html> as a percentage of the base size, so
 * all rem-based layout scales together. 100% → remove the inline style.
 */
export function applyAppearance(settings: Pick<AppSettings, 'theme' | 'fontScale'>): void {
  applyTheme(settings.theme)
  applyFontScale(settings.fontScale)
}

let mediaQuery: MediaQueryList | null = null
let systemDarkListener: ((event: MediaQueryListEvent) => void) | null = null

export function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement

  const apply = (dark: boolean): void => {
    root.classList.toggle('dark', dark)
  }

  // Stop listening for OS theme changes when not in 'system' mode.
  if (mediaQuery && systemDarkListener) {
    mediaQuery.removeEventListener('change', systemDarkListener)
    mediaQuery = null
    systemDarkListener = null
  }

  if (theme === 'dark') {
    apply(true)
  } else if (theme === 'light') {
    apply(false)
  } else {
    // Follow the system, live.
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemDarkListener = (event): void => apply(event.matches)
    mediaQuery.addEventListener('change', systemDarkListener)
    apply(mediaQuery.matches)
  }
}

export function applyFontScale(fontScale: AppSettings['fontScale']): void {
  const root = document.documentElement
  if (fontScale && fontScale !== 100) {
    root.style.fontSize = `${fontScale}%`
  } else {
    root.style.fontSize = ''
  }
}
