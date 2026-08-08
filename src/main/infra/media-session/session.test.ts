import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the platform factory before importing session.ts.
const factory = vi.hoisted(() => vi.fn())

vi.mock('./index', () => ({ createMediaSession: factory }))

import {
  disposeMediaSession,
  initMediaSession,
  onMediaSessionCommand,
  updateMediaSession
} from './session'

describe('media session singleton', () => {
  const adapter = {
    update: vi.fn(),
    onCommand: vi.fn(() => () => undefined),
    dispose: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    factory.mockReset()
    factory.mockReturnValue(adapter)
    // Reset the module-level singleton so each test starts fresh.
    disposeMediaSession()
  })

  it('initMediaSession creates the adapter once', () => {
    initMediaSession()
    initMediaSession()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('updateMediaSession forwards to the adapter', () => {
    updateMediaSession({ title: 'E', artist: 'P', positionSec: 0, playing: false })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(adapter.update).toHaveBeenCalledWith({
      title: 'E',
      artist: 'P',
      positionSec: 0,
      playing: false
    })
  })

  it('onMediaSessionCommand wires the adapter callback', () => {
    const unsub = onMediaSessionCommand(() => undefined)
    expect(adapter.onCommand).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('disposeMediaSession releases and resets the adapter', () => {
    initMediaSession()
    disposeMediaSession()
    expect(adapter.dispose).toHaveBeenCalled()
    // Next init creates a fresh adapter.
    updateMediaSession({ title: 'E', artist: 'P', positionSec: 0, playing: false })
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
