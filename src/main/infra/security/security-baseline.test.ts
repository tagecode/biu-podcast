import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { sanitizeRichHtml } from '../sanitize/html'
import { DEVELOPMENT_CSP, getContentSecurityPolicy, PRODUCTION_CSP } from './csp-policy'
import { createMainWindowWebPreferences, MAIN_WINDOW_SECURITY_PREFERENCES } from './web-preferences'

describe('security baseline (Arch.md §15 / T9.2)', () => {
  describe('webPreferences', () => {
    it('enforces sandbox, contextIsolation, and no nodeIntegration', () => {
      expect(MAIN_WINDOW_SECURITY_PREFERENCES).toEqual({
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      })
    })

    it('createMainWindowWebPreferences merges preload with security prefs', () => {
      const prefs = createMainWindowWebPreferences('/tmp/preload.js')
      expect(prefs.preload).toBe('/tmp/preload.js')
      expect(prefs.sandbox).toBe(true)
      expect(prefs.contextIsolation).toBe(true)
      expect(prefs.nodeIntegration).toBe(false)
    })

    it('main entry wires createMainWindowWebPreferences into BrowserWindow', () => {
      const source = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8')
      expect(source).toContain('createMainWindowWebPreferences')
      expect(source).toMatch(/webPreferences:\s*createMainWindowWebPreferences\(/)
      expect(source).not.toMatch(/nodeIntegration:\s*true/)
      expect(source).not.toMatch(/sandbox:\s*false/)
      expect(source).not.toMatch(/contextIsolation:\s*false/)
    })
  })

  describe('CSP', () => {
    it('production CSP denies inline scripts and keeps default-src self', () => {
      expect(PRODUCTION_CSP).toContain("default-src 'self'")
      expect(PRODUCTION_CSP).toContain("script-src 'self'")
      expect(PRODUCTION_CSP).not.toContain("script-src 'self' 'unsafe-inline'")
      expect(getContentSecurityPolicy(false)).toBe(PRODUCTION_CSP)
    })

    it('development CSP allows Vite HMR while still setting a policy', () => {
      expect(DEVELOPMENT_CSP).toContain("default-src 'self'")
      expect(DEVELOPMENT_CSP).toContain('ws://localhost:')
      expect(getContentSecurityPolicy(true)).toBe(DEVELOPMENT_CSP)
    })

    it('main entry applies CSP at startup', () => {
      const source = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8')
      expect(source).toContain('applyContentSecurityPolicy')
    })
  })

  describe('HTML sanitization (main-process only)', () => {
    it('strips script and event-handler vectors from episode HTML', () => {
      const result = sanitizeRichHtml(
        '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:evil()">x</a>'
      )
      expect(result).toContain('<p>ok</p>')
      expect(result).not.toContain('<script>')
      expect(result).not.toMatch(/onerror/i)
      expect(result).not.toMatch(/javascript:/i)
    })
  })
})
