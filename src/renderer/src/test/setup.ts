import '@testing-library/jest-dom/vitest'
import { beforeAll } from 'vitest'

// Components use useTranslation() — ensure a configured i18n instance exists in
// tests (main.tsx normally initializes it). Pin to 'zh' so tests that assert
// Chinese copy behave deterministically regardless of the jsdom navigator
// language.
import i18n from '@/lib/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('zh')
})
