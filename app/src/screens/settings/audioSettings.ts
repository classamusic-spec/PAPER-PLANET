/* PAPER PLANET — the seam between the Settings contract and the live audio service. */

import { useCallback, useEffect, useRef } from 'react'
import type { AmbienceId, AudioBus, Settings } from '../../contracts'
import { AUDIO_BUSES } from '../../systems'
import { audio, haptics } from '../../audio'

/**
 * Push the saved settings into the running audio service.
 *
 * Nothing else in the app does this yet, so a screen that wants sound to match
 * the player's choices calls `useAudioSettings`. It is idempotent and cheap —
 * every setter below is a gain ramp or a boolean — so calling it on every
 * settings change is correct rather than wasteful.
 *
 * This properly belongs in the shell's <Boot>; see the note in the handover.
 */
export function applyAudioSettings(settings: Settings, ambienceOverride?: AmbienceId): void {
  for (const bus of AUDIO_BUSES) {
    const v = settings.volumes[bus]
    audio.setBusVolume(bus, typeof v === 'number' ? v : 1)
  }
  audio.setMusic(settings.music)
  audio.setAmbience(ambienceOverride ?? settings.ambience)
  haptics.setEnabled(settings.haptics)
}

/**
 * Keep the audio service in step with `settings` for as long as this screen is
 * mounted. Pass `ambienceOverride` when a screen runs its own bed (Zen), and
 * the player's own bed is restored on the way out.
 */
export function useAudioSettings(settings: Settings, ambienceOverride?: AmbienceId): void {
  useEffect(() => {
    applyAudioSettings(settings, ambienceOverride)
  }, [settings, ambienceOverride])

  useEffect(() => {
    if (ambienceOverride === undefined) return
    return () => {
      audio.setAmbience(settings.ambience, 1.6)
    }
    // Only the unmount matters here: restore whatever the player had chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambienceOverride === undefined])
}

/* ── auditioning a bus ───────────────────────────────────────────────────── */

/**
 * A fader you cannot hear is a guess. This is the pacing.
 *
 * Long enough that dragging a slider across the rail makes a handful of calm
 * sounds rather than a stutter, short enough that a single arrow-key nudge
 * answers immediately. Moving to a *different* fader always answers at once —
 * that is the moment the player is asking "what is this one?".
 */
const PREVIEW_GAP_MS = 480

/**
 * Returns `preview(bus)`: play one short, representative sound on that bus,
 * paced. Leading edge, then a trailing one, so the last thing heard is always
 * the value the fader was actually left at.
 */
export function useBusPreview(): (bus: AudioBus) => void {
  const last = useRef<{ bus: AudioBus | null; at: number }>({ bus: null, at: 0 })
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  return useCallback((bus: AudioBus) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const since = now - last.current.at
    if (bus !== last.current.bus || since >= PREVIEW_GAP_MS) {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      last.current = { bus, at: now }
      audio.previewBus(bus)
      return
    }
    if (timer.current !== null) return
    timer.current = window.setTimeout(() => {
      timer.current = null
      last.current = { bus, at: typeof performance !== 'undefined' ? performance.now() : Date.now() }
      audio.previewBus(bus)
    }, PREVIEW_GAP_MS - since)
  }, [])
}
