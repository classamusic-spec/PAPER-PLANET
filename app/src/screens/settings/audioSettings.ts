/* PAPER PLANET — the seam between the Settings contract and the live audio service. */

import { useEffect } from 'react'
import type { AmbienceId, Settings } from '../../contracts'
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
