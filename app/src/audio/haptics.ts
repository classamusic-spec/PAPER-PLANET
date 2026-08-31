// PAPER PLANET — vibration patterns paired to sound. Patterns are BRAND.md §8 verbatim.

import type { HapticPattern, HapticService } from '../contracts'

/**
 * BRAND.md §8. A single number is one pulse; an array alternates
 * vibrate / pause / vibrate, which is what `navigator.vibrate` expects.
 */
const PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 4,
  creaseSet: [18, 40, 26],
  foldComplete: 28,
  flip: [10, 30, 10],
  press: [40, 30, 60],
  alive: [30, 50, 40, 60, 90],
  // Not tabulated in §8. A reward is a small rising flourish…
  reward: [12, 36, 18, 36, 30],
  // …and an error is a soft double, never a buzz. Pillar II: nothing punishes.
  error: [16, 60, 16],
}

/** §8: crease ticks during a rub. Any faster and it reads as a buzz, not paper. */
const TICK_INTERVAL_MS = 45

type VibrateWindow = Navigator & { vibrate?: (pattern: number | number[]) => boolean }

/**
 * Haptics are an optional partner to sound, never a channel on their own
 * (BRAND §11). Absent support — every iOS browser, most desktops — is a silent
 * no-op rather than a feature check the caller has to make.
 */
export class Haptics implements HapticService {
  private enabled = true
  private lastTick = 0

  private vibrate(pattern: number | number[]): void {
    if (!this.enabled || typeof navigator === 'undefined') return
    const nav = navigator as VibrateWindow
    if (typeof nav.vibrate !== 'function') return
    try {
      nav.vibrate(pattern)
    } catch {
      /* some browsers throw when the page is not visible */
    }
  }

  fire(pattern: HapticPattern): void {
    const p = PATTERNS[pattern]
    if (p === undefined) return
    this.vibrate(p)
  }

  /**
   * Continuous light ticks during a rub. Self-throttling: the caller fires this
   * on every pointermove and we decide how much of that becomes vibration.
   */
  tick(intensity: number): void {
    if (!this.enabled) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - this.lastTick < TICK_INTERVAL_MS) return
    this.lastTick = now
    // The Vibration API has no amplitude, only duration — so intensity becomes
    // a longer pulse, from a bare 3ms flick up to a firm 8ms.
    const clamped = Math.max(0, Math.min(1, intensity))
    this.vibrate(Math.round(3 + clamped * 5))
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) {
      try {
        const nav = navigator as VibrateWindow
        nav.vibrate?.(0)
      } catch { /* ignore */ }
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }
}

export const haptics = new Haptics()
