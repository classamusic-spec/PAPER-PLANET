/* PAPER PLANET — boot. Content is injected into systems, never imported by it. */

import { useEffect, useState, type ReactNode } from 'react'
import { actions, bootGame, useHydrated } from '../systems'
import { audio } from '../audio'

/**
 * Loads content, hydrates the save, attaches the store provider, and keeps the
 * day and the system theme honest while the app is open.
 *
 * Content is imported here — the one place that knows about both halves — so
 * `systems/` stays free of any dependency on `content/`.
 */
export function Boot({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated()
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let detach: (() => void) | undefined
    let cancelled = false

    void (async () => {
      try {
        const content = await import('../content')
        if (cancelled) return
        detach = await bootGame({
          species: content.allSpecies(),
          washi: content.allWashi(),
          biomes: content.allBiomes(),
        })
      } catch (err) {
        // A content failure must not white-screen the app; the shell's error
        // boundary shows a torn sheet and the player can reload.
        if (!cancelled) setFailed(err instanceof Error ? err.message : 'content failed to load')
      }
    })()

    return () => {
      cancelled = true
      detach?.()
    }
  }, [])

  /* The Daily Fold has to roll over even if the app was left open overnight,
     and audio must not keep playing once the app is backgrounded. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') actions.refreshDay()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /* Audio needs a real gesture before it will sound. Arm on the first one. */
  useEffect(() => {
    const unlock = () => void audio.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  if (failed) throw new Error(failed)
  if (!hydrated) return <>{fallback ?? <div className="pp-boot" aria-busy="true" />}</>
  return <>{children}</>
}
