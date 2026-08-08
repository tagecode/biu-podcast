import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyAppearance } from './lib/appearance'
import i18n, { resolveLanguage } from './lib/i18n'

// Apply the default (follow-system) appearance before the first paint so dark
// theme users don't see a flash of light UI. The persisted preference is loaded
// and applied below.
applyAppearance({ theme: 'system', fontScale: 100 })

void window.api.settings.get().then((result) => {
  if (result.ok) {
    applyAppearance(result.data)
    const lang = resolveLanguage(result.data.language)
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
