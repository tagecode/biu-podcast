import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

import type { MediaSessionAdapter } from './types'

/**
 * Windows SMTC adapter: spawns the .NET companion process (`companion-win`,
 * published as `resources/companion/biu-podcast-smtc.exe`) and bridges the
 * System Media Transport Controls over stdio JSON lines.
 *
 * See mdocs/P1-13-Spike.md §3.3 for the Spike decision (self-hosted .NET
 * process instead of a native node addon or a third-party lib).
 */

const COMPANION_PACKAGED = (): string =>
  join(process.resourcesPath, 'companion', 'biu-podcast-smtc.exe')
const COMPANION_DEV = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'companion-win',
  'bin',
  'publish',
  'biu-podcast-smtc.exe'
)

interface JsonLine {
  type: string
  command?: string
  [key: string]: unknown
}

export function createWinSmtcAdapter(): MediaSessionAdapter {
  const exe = app.isPackaged ? COMPANION_PACKAGED() : COMPANION_DEV

  let child: ChildProcessWithoutNullStreams | null = null
  const commandListeners = new Set<(cmd: 'play' | 'pause' | 'next' | 'previous') => void>()
  let disposed = false

  function start(): boolean {
    if (disposed || child) return false
    if (!existsSync(exe)) {
      console.warn(`[media-session] SMTC companion not found at ${exe}`)
      return false
    }
    try {
      child = spawn(exe, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    } catch (error) {
      console.warn('[media-session] failed to spawn SMTC companion:', error)
      return false
    }

    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as JsonLine
          if (msg.type === 'command' && msg.command) {
            const cmd = msg.command as 'play' | 'pause' | 'next' | 'previous'
            commandListeners.forEach((cb) => cb(cmd))
          }
        } catch {
          // ignore malformed line
        }
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      console.warn(`[media-session] smtc: ${String(chunk).trim()}`)
    })
    child.on('exit', (code) => {
      console.warn(`[media-session] SMTC companion exited (${code})`)
      child = null
      if (!disposed) {
        // Restart on crash so media controls stay available.
        start()
      }
    })
    return true
  }

  function send(msg: Record<string, unknown>): void {
    if (!child) return
    child.stdin.write(JSON.stringify(msg) + '\n')
  }

  return {
    update(info) {
      if (!start()) return
      send({
        type: 'metadata',
        title: info.title,
        artist: info.artist,
        album: info.artist,
        artworkUrl: info.artworkUrl
      })
      send({ type: 'state', playing: info.playing })
    },

    onCommand(cb) {
      commandListeners.add(cb)
      if (!child) start()
      return () => {
        commandListeners.delete(cb)
      }
    },

    dispose() {
      disposed = true
      commandListeners.clear()
      if (child) {
        child.kill()
        child = null
      }
    }
  }
}
