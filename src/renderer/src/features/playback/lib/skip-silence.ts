export const SKIP_SILENCE = {
  rmsThreshold: 0.015,
  minSilenceMs: 1500,
  paddingMs: 200,
  hopMs: 1000
} as const

export function rmsFromByteTimeDomain(samples: Uint8Array): number {
  if (samples.length === 0) return Number.NaN
  let sum = 0
  for (const sample of samples) {
    const normalized = (sample - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / samples.length)
}

export type SkipSilencePhase = 'idle' | 'accumulating' | 'skipping'

export function reduceSkipSilence(
  state: { phase: SkipSilencePhase; silentMs: number },
  input: { rms: number; dtMs: number; currentTimeSec: number; durationSec: number }
): { phase: SkipSilencePhase; silentMs: number; seekToSec: number | null } {
  if (!Number.isFinite(input.rms) || !Number.isFinite(input.dtMs) || input.dtMs < 0) {
    return { phase: state.phase, silentMs: state.silentMs, seekToSec: null }
  }

  const silent = input.rms < SKIP_SILENCE.rmsThreshold
  const maxSeek = Math.max(0, input.durationSec - 0.25)
  const hopTo = Math.min(input.currentTimeSec + SKIP_SILENCE.hopMs / 1000, maxSeek)

  if (state.phase === 'skipping') {
    if (silent) {
      return { phase: 'skipping', silentMs: state.silentMs + input.dtMs, seekToSec: hopTo }
    }
    return {
      phase: 'idle',
      silentMs: 0,
      seekToSec: Math.max(0, input.currentTimeSec - SKIP_SILENCE.paddingMs / 1000)
    }
  }

  if (!silent) {
    return { phase: 'idle', silentMs: 0, seekToSec: null }
  }

  const silentMs = (state.phase === 'idle' ? 0 : state.silentMs) + input.dtMs
  if (silentMs >= SKIP_SILENCE.minSilenceMs) {
    return { phase: 'skipping', silentMs, seekToSec: hopTo }
  }
  return { phase: 'accumulating', silentMs, seekToSec: null }
}
