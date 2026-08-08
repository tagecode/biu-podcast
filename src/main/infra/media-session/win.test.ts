import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock electron + child_process before importing the adapter.
const mock = vi.hoisted(() => {
  return {
    exeExists: true,
    isPackaged: false,
    child: {
      stdin: { write: vi.fn() },
      stdout: { setEncoding: vi.fn(), on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn()
    },
    existsSync: vi.fn(() => mock.exeExists),
    spawn: vi.fn(() => mock.child)
  }
})

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/app'
  }
}))

vi.mock('child_process', () => ({
  spawn: mock.spawn
}))

vi.mock('fs', () => ({
  existsSync: mock.existsSync
}))

import { createWinSmtcAdapter } from './win'

/** Grab the 'data' callback registered on stdout for feeding JSON lines. */
function stdoutDataHandler(): (chunk: string) => void {
  const calls = mock.child.stdout.on.mock.calls as Array<[string, (chunk: string) => void]>
  const data = calls.find(([event]) => event === 'data')
  if (!data) throw new Error('no data handler registered')
  return data[1]
}

/** Grab the 'exit' handler on the child process. */
function exitHandler(): (code: number) => void {
  const calls = mock.child.on.mock.calls as Array<[string, (code: number) => void]>
  const exit = calls.find(([event]) => event === 'exit')
  if (!exit) throw new Error('no exit handler registered')
  return exit[1]
}

describe('Windows SMTC adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.exeExists = true
    mock.isPackaged = false
  })

  it('spawns the companion lazily on first update', () => {
    const adapter = createWinSmtcAdapter()
    expect(mock.spawn).not.toHaveBeenCalled()
    adapter.update({ title: 'E', artist: 'P', positionSec: 0, playing: true })
    expect(mock.spawn).toHaveBeenCalledTimes(1)
  })

  it('writes metadata + state JSON lines to stdin', () => {
    const adapter = createWinSmtcAdapter()
    adapter.update({
      title: 'Episode 1',
      artist: 'Pod',
      artworkUrl: 'https://example.com/a.jpg',
      durationSec: 300,
      positionSec: 12,
      playing: true
    })
    const writes = mock.child.stdin.write.mock.calls.map((c) => c[0] as string)
    expect(writes).toHaveLength(2)
    const metadata = JSON.parse(writes[0])
    expect(metadata).toEqual({
      type: 'metadata',
      title: 'Episode 1',
      artist: 'Pod',
      album: 'Pod',
      artworkUrl: 'https://example.com/a.jpg'
    })
    const state = JSON.parse(writes[1])
    expect(state).toEqual({ type: 'state', playing: true })
  })

  it('writes only metadata + state', () => {
    const adapter = createWinSmtcAdapter()
    adapter.update({ title: 'E', artist: 'P', positionSec: 5, playing: false })
    const writes = mock.child.stdin.write.mock.calls.map((c) => c[0] as string)
    expect(writes).toHaveLength(2) // metadata + state only
  })

  it('forwards commands from the companion stdout to subscribers', () => {
    const adapter = createWinSmtcAdapter()
    const received: string[] = []
    adapter.onCommand((cmd) => received.push(cmd))
    adapter.update({ title: 'E', artist: 'P', positionSec: 0, playing: false })

    const handler = stdoutDataHandler()
    handler('{"type":"command","command":"play"}\n')
    handler('{"type":"command","command":"next"}\n')
    expect(received).toEqual(['play', 'next'])
  })

  it('does not spawn when the companion exe is missing', () => {
    mock.exeExists = false
    const adapter = createWinSmtcAdapter()
    adapter.update({ title: 'E', artist: 'P', positionSec: 0, playing: true })
    expect(mock.spawn).not.toHaveBeenCalled()
  })

  it('dispose kills the child', () => {
    const adapter = createWinSmtcAdapter()
    adapter.update({ title: 'E', artist: 'P', positionSec: 0, playing: true })
    adapter.dispose()
    expect(mock.child.kill).toHaveBeenCalled()
  })

  it('restarts the companion on unexpected exit', () => {
    const adapter = createWinSmtcAdapter()
    adapter.update({ title: 'E', artist: 'P', positionSec: 0, playing: true })
    expect(mock.spawn).toHaveBeenCalledTimes(1)
    exitHandler()(1)
    // Second update after crash re-spawns.
    adapter.update({ title: 'E2', artist: 'P', positionSec: 0, playing: false })
    expect(mock.spawn).toHaveBeenCalledTimes(2)
  })
})
