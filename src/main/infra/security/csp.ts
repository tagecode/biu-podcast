import { session } from 'electron'
import { is } from '@electron-toolkit/utils'

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' blob: file: https:",
  "connect-src 'self' https: http:",
  "font-src 'self' data:"
].join('; ')

/** Vite HMR / React Refresh inject inline scripts and use WebSocket in development. */
const DEVELOPMENT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "media-src 'self' blob: file: https:",
  "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https: http: ws: wss:",
  "font-src 'self' data:"
].join('; ')

export function applyContentSecurityPolicy(): void {
  const policy = is.dev ? DEVELOPMENT_CSP : PRODUCTION_CSP

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
}
