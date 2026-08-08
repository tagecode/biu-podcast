/**
 * Convert a captured KeyboardEvent into an Electron accelerator string.
 * Returns null for pure-modifier presses and for keys we can't represent.
 * A global shortcut needs at least one modifier (unless it's a function key).
 */
export function eventToAccelerator(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let base: string | null = null
  const code = e.code
  if (code.startsWith('Key')) {
    base = code.slice(3).toUpperCase()
  } else if (code.startsWith('Digit')) {
    base = code.slice(5)
  } else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    base = code
  } else if (code === 'Space') {
    base = 'Space'
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code)) {
    base = code
  }
  if (!base) return null

  if (parts.length === 0 && !/^F\d+$/.test(base)) return null
  parts.push(base)
  return parts.join('+')
}
