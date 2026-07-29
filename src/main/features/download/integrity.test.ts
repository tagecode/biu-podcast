import { describe, expect, it } from 'vitest'

import { assertDownloadComplete } from './integrity'

describe('assertDownloadComplete', () => {
  it('passes when expected size is unknown', () => {
    expect(() => assertDownloadComplete(100, null)).not.toThrow()
    expect(() => assertDownloadComplete(100, undefined)).not.toThrow()
  })

  it('passes when actual size matches expected', () => {
    expect(() => assertDownloadComplete(1024, 1024)).not.toThrow()
  })

  it('fails when actual size is smaller than expected', () => {
    expect(() => assertDownloadComplete(500, 1024)).toThrow(/不完整/)
  })

  it('fails when actual size is larger than expected', () => {
    expect(() => assertDownloadComplete(2048, 1024)).toThrow(/不完整/)
  })
})
