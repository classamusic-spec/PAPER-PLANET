// PAPER PLANET — shared UI hooks: motion, measurement, focus trapping, scroll lock, sound seam.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

/** A style object that may also carry CSS custom properties. */
export type CSSVars = CSSProperties & Record<`--${string}`, string | number | undefined>

/* ── reduced motion ───────────────────────────────────────────────────────── */

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** True when the player has asked the OS to calm everything down. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(REDUCE_QUERY).matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(REDUCE_QUERY)
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    setReduced(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/* ── measurement ──────────────────────────────────────────────────────────
   One ResizeObserver for the whole app. A screen with a hundred sheets on it
   still only pays for a single observer callback. */

type SizeListener = (w: number, h: number) => void

const listeners = new WeakMap<Element, SizeListener>()
let sharedObserver: ResizeObserver | null = null

function getObserver(): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') return null
  if (!sharedObserver) {
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const fn = listeners.get(entry.target)
        if (!fn) continue
        const box = entry.borderBoxSize?.[0]
        if (box) fn(box.inlineSize, box.blockSize)
        else fn(entry.contentRect.width, entry.contentRect.height)
      }
    })
  }
  return sharedObserver
}

export interface Size {
  w: number
  h: number
}

/** Measure an element's border box. `enabled: false` costs nothing at all. */
export function useElementSize<T extends HTMLElement>(enabled = true): [RefObject<T | null>, Size] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const apply = (w: number, h: number): void =>
      setSize((prev) => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }))
    apply(el.offsetWidth, el.offsetHeight)
    const obs = getObserver()
    if (!obs) return
    listeners.set(el, apply)
    obs.observe(el)
    return () => {
      listeners.delete(el)
      obs.unobserve(el)
    }
  }, [enabled])

  return [ref, size]
}

/* ── a stable seed per component instance ─────────────────────────────────── */

/** Use the caller's seed if given, otherwise a stable per-instance one. */
export function useSeed(seed?: string | number): string | number {
  const auto = useId()
  return seed ?? auto
}

/* ── body scroll lock ─────────────────────────────────────────────────────── */

let lockCount = 0

/** Freeze the page behind a Sheet. Reference-counted, so nested sheets are safe. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lockCount += 1
    const body = document.body
    const previousTop = window.scrollY
    body.setAttribute('data-scroll-locked', 'true')
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) {
        body.removeAttribute('data-scroll-locked')
        window.scrollTo({ top: previousTop, behavior: 'instant' as ScrollBehavior })
      }
    }
  }, [active])
}

/* ── focus trap ───────────────────────────────────────────────────────────── */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  )
}

/**
 * Keep keyboard focus inside `ref` while `active`, and hand it back to whatever
 * had it when the trap closes.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const root = ref.current
    if (!active || !root) return
    const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const first = focusables(root)[0] ?? root
    window.requestAnimationFrame(() => first.focus({ preventScroll: true }))

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return
      const items = focusables(root)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const head = items[0]
      const tail = items[items.length - 1]
      const active_ = document.activeElement
      if (e.shiftKey && (active_ === head || !root.contains(active_))) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && active_ === tail) {
        e.preventDefault()
        head.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      restoreTo?.focus({ preventScroll: true })
    }
  }, [ref, active])
}

/* ── Escape ───────────────────────────────────────────────────────────────── */

export function useEscape(active: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape)
  handler.current = onEscape
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handler.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active])
}

/* ── count-up ─────────────────────────────────────────────────────────────── */

/** Tween a number toward `target`. Snaps instantly under reduced motion. */
export function useCountUp(target: number, duration = 620): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    if (reduced || duration <= 0) {
      fromRef.current = target
      setValue(target)
      return
    }
    const from = fromRef.current
    if (from === target) return
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration)
      // ease-settle: the number lands, it does not bounce
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (target - from) * eased
      setValue(t === 1 ? target : next)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration, reduced])

  return value
}

/* ── the sound seam ───────────────────────────────────────────────────────
   The kit is presentational: it never imports `audio/`. It announces the cue
   it wants and the shell decides whether anything is listening. */

export type PaperCue =
  | 'ui.tap'
  | 'ui.back'
  | 'ui.confirm'
  | 'ui.open'
  | 'ui.close'
  | 'ui.toggle'
  | 'sheet.slide'
  | 'sheet.settle'
  | 'sheet.lift'
  | 'sheet.flip'
  | 'press.flatten'
  | 'press.release'
  | 'reward.sheets'
  | 'reward.goldleaf'

export interface PaperCueDetail {
  cue: PaperCue
}

export const PAPER_CUE_EVENT = 'pp:cue'

/**
 * Returns a stable `play(cue)`. It dispatches a `pp:cue` CustomEvent on
 * `window`; the shell forwards it to `AudioService.play`. If nothing is
 * listening the call is free.
 */
export function usePaperSound(): (cue: PaperCue) => void {
  return useCallback((cue: PaperCue) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent<PaperCueDetail>(PAPER_CUE_EVENT, { detail: { cue } }))
  }, [])
}
