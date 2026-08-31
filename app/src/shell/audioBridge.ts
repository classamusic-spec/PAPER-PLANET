/* PAPER PLANET — lets presentational UI request a sound without importing audio. */

import { audio } from '../audio'
import type { SfxCue } from '../contracts'

/** Detail carried by the `pp:cue` CustomEvent. */
export interface CueDetail {
  cue: SfxCue
  volume?: number
}

/**
 * The UI kit is presentational and must not depend on the audio module, so it
 * dispatches `pp:cue` on window instead. The shell is the only thing that
 * knows both sides.
 */
export function installAudioBridge(): () => void {
  const onCue = (e: Event) => {
    const detail = (e as CustomEvent<CueDetail>).detail
    if (!detail?.cue) return
    audio.play(detail.cue, detail.volume === undefined ? undefined : { volume: detail.volume })
  }
  window.addEventListener('pp:cue', onCue)
  return () => window.removeEventListener('pp:cue', onCue)
}

/** Convenience for non-React callers. */
export function cue(name: SfxCue, volume?: number) {
  window.dispatchEvent(new CustomEvent<CueDetail>('pp:cue', { detail: { cue: name, volume } }))
}
