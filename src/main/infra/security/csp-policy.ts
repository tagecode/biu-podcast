export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: http: biu-media:",
  // Podcast audio URLs are frequently plain http:// — media must allow both.
  "media-src 'self' blob: file: https: http:",
  "connect-src 'self' https: http:",
  "font-src 'self' data:"
].join('; ')

/** Vite HMR / React Refresh inject inline scripts and use WebSocket in development. */
export const DEVELOPMENT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob: http: biu-media:",
  "media-src 'self' blob: file: https: http:",
  "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https: http: ws: wss:",
  "font-src 'self' data:"
].join('; ')

export function getContentSecurityPolicy(isDev: boolean): string {
  return isDev ? DEVELOPMENT_CSP : PRODUCTION_CSP
}
