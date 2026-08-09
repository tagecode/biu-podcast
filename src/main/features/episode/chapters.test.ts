import { describe, expect, it } from 'vitest'

import { parseChaptersJson } from './chapters'

describe('parseChaptersJson', () => {
  it('parses a standard chapters document, sorted by startTime', () => {
    const chapters = parseChaptersJson(
      JSON.stringify({
        version: '1.2.0',
        chapters: [
          { startTime: 10, title: 'Middle' },
          { startTime: 0, title: 'Intro' },
          { startTime: 100, title: 'Outro' }
        ]
      })
    )
    expect(chapters).toEqual([
      { startTime: 0, title: 'Intro' },
      { startTime: 10, title: 'Middle' },
      { startTime: 100, title: 'Outro' }
    ])
  })

  it('drops invalid entries and keeps valid ones', () => {
    const chapters = parseChaptersJson(
      JSON.stringify({
        version: '1.2.0',
        chapters: [
          { startTime: -1, title: 'Negative' },
          { startTime: 5, title: '' },
          { startTime: 5, title: 'Valid' },
          { startTime: 'x', title: 'BadTs' },
          null
        ]
      })
    )
    expect(chapters).toEqual([{ startTime: 5, title: 'Valid' }])
  })

  it('returns [] for malformed json or missing chapters array', () => {
    expect(parseChaptersJson('not json')).toEqual([])
    expect(parseChaptersJson('{"version":"1.2.0"}')).toEqual([])
    expect(parseChaptersJson('{"chapters":{}}')).toEqual([])
  })
})
