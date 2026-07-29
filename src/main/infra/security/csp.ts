import { session } from 'electron'
import { is } from '@electron-toolkit/utils'

import { getContentSecurityPolicy } from './csp-policy'

export { DEVELOPMENT_CSP, getContentSecurityPolicy, PRODUCTION_CSP } from './csp-policy'

export function applyContentSecurityPolicy(): void {
  const policy = getContentSecurityPolicy(is.dev)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
}
