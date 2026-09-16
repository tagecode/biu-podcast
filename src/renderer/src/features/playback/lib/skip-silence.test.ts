import { describe, expect, it } from 'vitest'

import {
  reduceSkipSilence,
  rmsFromByteTimeDomain,
  SKIP_SILENCE,
  type SkipSilencePhase
} from './skip-silence'

const idle = { phase: 'idle' as SkipSilencePhase, silentMs: 0 }

describe('rmsFromByteTimeDomain', () => {
  it('returns near-zero for a silent buffer centered at 128', () => {
    expect(rmsFromByteTimeDomain(Uint8Array.from({ length: 8 }, () => 128))).toBeCloseTo(0)
  })

  it('returns NaN for an empty buffer', () => {
    expect(Number.isNaN(rmsFromByteTimeDomain(new Uint8Array()))).toBe(true)
  })
})

describe('reduceSkipSilence', () => {
  it('does not seek for a short dip under 1.5s', () => {
    const first = reduceSkipSilence(idle, {
      rms: 0.001,
      dtMs: 1000,
      currentTimeSec: 10,
      durationSec: 60
    })
    expect(first.phase).toBe('accumulating')
    expect(first.seekToSec).toBeNull()

    const second = reduceSkipSilence(first, {
      rms: 0.001,
      dtMs: 400,
      currentTimeSec: 11,
      durationSec: 60
    })
    expect(second.silentMs).toBeLessThan(SKIP_SILENCE.minSilenceMs)
    expect(second.seekToSec).toBeNull()

    const speech = reduceSkipSilence(second, {
      rms: 0.05,
      dtMs: 100,
      currentTimeSec: 11.4,
      durationSec: 60
    })
    expect(speech.phase).toBe('idle')
    expect(speech.silentMs).toBe(0)
    expect(speech.seekToSec).toBeNull()
  })

  it('seeks forward after 1.5s of silence', () => {
    const result = reduceSkipSilence(idle, {
      rms: 0.001,
      dtMs: SKIP_SILENCE.minSilenceMs,
      currentTimeSec: 10,
      durationSec: 60
    })
    expect(result.phase).toBe('skipping')
    expect(result.seekToSec).toBe(10 + SKIP_SILENCE.hopMs / 1000)
  })

  it('seeks back by padding when speech returns after a skip', () => {
    const skipping = reduceSkipSilence(idle, {
      rms: 0.001,
      dtMs: SKIP_SILENCE.minSilenceMs,
      currentTimeSec: 10,
      durationSec: 60
    })
    const speech = reduceSkipSilence(skipping, {
      rms: 0.05,
      dtMs: 100,
      currentTimeSec: 12,
      durationSec: 60
    })
    expect(speech.phase).toBe('idle')
    expect(speech.seekToSec).toBe(12 - SKIP_SILENCE.paddingMs / 1000)
  })

  it('does not seek when rms is NaN or duration is unusable', () => {
    const nan = reduceSkipSilence(idle, {
      rms: Number.NaN,
      dtMs: 2000,
      currentTimeSec: 10,
      durationSec: 60
    })
    expect(nan.seekToSec).toBeNull()
    expect(nan.phase).toBe('idle')

    const empty = reduceSkipSilence(idle, {
      rms: rmsFromByteTimeDomain(new Uint8Array()),
      dtMs: 2000,
      currentTimeSec: 10,
      durationSec: 60
    })
    expect(empty.seekToSec).toBeNull()
  })

  it('never seeks past duration minus 0.25s', () => {
    const result = reduceSkipSilence(idle, {
      rms: 0.001,
      dtMs: SKIP_SILENCE.minSilenceMs,
      currentTimeSec: 59.9,
      durationSec: 60
    })
    expect(result.seekToSec).toBe(59.75)
  })
})
