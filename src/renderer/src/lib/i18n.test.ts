import { describe, expect, it } from 'vitest'

import { en } from '../locales/en'
import { zh } from '../locales/zh'

type Obj = Record<string, unknown>

function isRecord(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null
}

/** Collect leaf keys with their full dotted path. */
function leafKeys(obj: Obj, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isRecord(value)) {
      keys.push(...leafKeys(value, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

describe('i18n locale resources', () => {
  it('zh and en expose the same key structure', () => {
    expect(leafKeys(en as Obj).sort()).toEqual(leafKeys(zh as Obj).sort())
  })

  it('has a non-empty value for every zh key', () => {
    for (const key of leafKeys(zh as Obj)) {
      expect(String(getNested(zh, key)).length).toBeGreaterThan(0)
    }
  })

  it('has a non-empty value for every en key', () => {
    for (const key of leafKeys(en as Obj)) {
      expect(String(getNested(en, key)).length).toBeGreaterThan(0)
    }
  })
})

function getNested(root: Obj, path: string): unknown {
  let cursor: unknown = root
  for (const part of path.split('.')) {
    if (!isRecord(cursor)) return undefined
    cursor = cursor[part]
  }
  return cursor
}
