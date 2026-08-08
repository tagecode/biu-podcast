import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock mpris-service (CJS) before importing the adapter.
const playerMock = vi.hoisted(() => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    listeners,
    factory: vi.fn(() => playerMock.instance),
    instance: {
      metadata: {},
      playbackStatus: 'Paused' as string,
      canControl: false,
      canPlay: false,
      canPause: false,
      canGoNext: false,
      canGoPrevious: false,
      objectPath: vi.fn((sub: string) => `/org/mpris/MediaPlayer2/${sub}`),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        const arr = listeners.get(event) ?? []
        arr.push(cb)
        listeners.set(event, arr)
        return playerMock.instance
      }),
      removeAllListeners: vi.fn(() => {
        listeners.clear()
        return playerMock.instance
      }),
      seeked: vi.fn()
    }
  }
})

vi.mock('mpris-service', () => ({ default: playerMock.factory }))

import { createLinuxMprisAdapter } from './linux'

describe('Linux MPRIS adapter', () => {
  beforeEach(() => {
    playerMock.listeners.clear()
    playerMock.instance.metadata = {}
    playerMock.instance.playbackStatus = 'Paused'
    vi.clearAllMocks()
  })

  it('creates the player with a biu_podcast bus name', () => {
    createLinuxMprisAdapter()
    expect(playerMock.factory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'biu_podcast', identity: '博播 BiuPodcast' })
    )
  })

  it('update() maps metadata + playing state to MPRIS', () => {
    const adapter = createLinuxMprisAdapter()
    adapter.update({
      title: 'Episode 1',
      artist: 'My Podcast',
      artworkUrl: 'https://example.com/art.jpg',
      durationSec: 300,
      positionSec: 12,
      playing: true
    })
    expect(playerMock.instance.metadata).toEqual({
      'mpris:trackid': '/org/mpris/MediaPlayer2/track/0',
      'xesam:title': 'Episode 1',
      'xesam:artist': ['My Podcast'],
      'xesam:album': 'My Podcast',
      'mpris:length': 300_000_000,
      'mpris:artUrl': 'https://example.com/art.jpg'
    })
    expect(playerMock.instance.playbackStatus).toBe('Playing')
    expect(playerMock.instance.seeked).toHaveBeenCalledWith(12_000_000)
  })

  it('omits duration/artwork when unknown', () => {
    const adapter = createLinuxMprisAdapter()
    adapter.update({
      title: 'E',
      artist: 'P',
      positionSec: 0,
      playing: false
    })
    expect(playerMock.instance.metadata).not.toHaveProperty('mpris:length')
    expect(playerMock.instance.metadata).not.toHaveProperty('mpris:artUrl')
    expect(playerMock.instance.playbackStatus).toBe('Paused')
  })

  it('routes media-center commands to the subscriber', () => {
    const adapter = createLinuxMprisAdapter()
    const received: string[] = []
    const unsubscribe = adapter.onCommand((cmd) => received.push(cmd))

    // Emit the MPRIS events mpris-service surfaces for player buttons.
    const fire = (event: string): void => {
      const cbs = playerMock.listeners.get(event) ?? []
      cbs.forEach((cb) => cb())
    }
    fire('play')
    fire('pause')
    fire('next')
    fire('previous')
    expect(received).toEqual(['play', 'pause', 'next', 'previous'])

    unsubscribe()
    playerMock.listeners.clear()
    fire('play')
    expect(received).toHaveLength(4)
  })

  it('dispose removes listeners', () => {
    const adapter = createLinuxMprisAdapter()
    adapter.onCommand(() => undefined)
    adapter.dispose()
    expect(playerMock.instance.removeAllListeners).toHaveBeenCalled()
  })
})
