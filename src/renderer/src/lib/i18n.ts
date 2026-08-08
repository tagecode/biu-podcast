import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { en } from '../locales/en'
import { zh } from '../locales/zh'

export const LOCALES = { zh, en } as const

/** Resolve 'system' → an actual i18n language code. */
export function resolveSystemLanguage(): 'zh' | 'en' {
  const navLang = (navigator.language || 'en').toLowerCase()
  return navLang.startsWith('zh') ? 'zh' : 'en'
}

/** Resolve the stored preference ('system' | 'zh' | 'en') to a concrete code. */
export function resolveLanguage(preference: 'system' | 'zh' | 'en'): 'zh' | 'en' {
  return preference === 'system' ? resolveSystemLanguage() : preference
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en }
  },
  lng: resolveLanguage('system'),
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
