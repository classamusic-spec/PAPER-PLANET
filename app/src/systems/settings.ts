/* PAPER PLANET — the Settings slice: defaults, `auto` theme resolution, and applying it to the document. */

import type { AmbienceId, AudioBus, Settings } from '../contracts'
import { clamp01 } from './rand'

/**
 * The environment queries Settings depends on, behind an interface so the module
 * is pure under node (self-test) and honest in the browser.
 */
export interface SettingsEnv {
  prefersDark(): boolean
  prefersReducedMotion(): boolean
  /** Subscribe to system theme changes. Returns an unsubscribe. */
  onSystemThemeChange(cb: () => void): () => void
}

function matches(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  } catch {
    return false
  }
}

/** The real browser environment. Every access is guarded — this runs under node too. */
export const browserEnv: SettingsEnv = {
  prefersDark: () => matches('(prefers-color-scheme: dark)'),
  prefersReducedMotion: () => matches('(prefers-reduced-motion: reduce)'),
  onSystemThemeChange(cb) {
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => cb()
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } catch {
      return () => {}
    }
  },
}

/** A quiet, opinionated environment for node and for tests. */
export const staticEnv = (opts?: { dark?: boolean; reducedMotion?: boolean }): SettingsEnv => ({
  prefersDark: () => opts?.dark ?? false,
  prefersReducedMotion: () => opts?.reducedMotion ?? false,
  onSystemThemeChange: () => () => {},
})

export const AUDIO_BUSES: readonly AudioBus[] = ['master', 'sfx', 'ambience', 'music']

/**
 * Defaults. Sound on, motion honoured, guides on, day/night following the system.
 * Nothing here is a nag: no "rate us", no notification opt-in, no analytics toggle.
 */
export function defaultSettings(env: SettingsEnv = browserEnv): Settings {
  return {
    theme: 'auto',
    reducedMotion: env.prefersReducedMotion(),
    highInk: false,
    assistMode: false,
    haptics: true,
    volumes: { master: 0.9, sfx: 1, ambience: 0.3, music: 0.28 },
    ambience: 'meadow',
    music: true,
    guides: true,
    leftHanded: false,
  }
}

const THEMES: readonly Settings['theme'][] = ['day', 'night', 'auto']
const AMBIENCES: readonly AmbienceId[] = ['meadow', 'rain', 'night', 'shore', 'tearoom', 'none']

/** Coerce anything off disk into a valid Settings. Unknown values fall back, never throw. */
export function normalizeSettings(input: unknown, env: SettingsEnv = browserEnv): Settings {
  const base = defaultSettings(env)
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return base
  const raw = input as Record<string, unknown>

  const theme = THEMES.includes(raw.theme as Settings['theme']) ? (raw.theme as Settings['theme']) : base.theme
  const ambience = AMBIENCES.includes(raw.ambience as AmbienceId) ? (raw.ambience as AmbienceId) : base.ambience

  const volumes: Record<AudioBus, number> = { ...base.volumes }
  const rawVolumes = raw.volumes
  if (typeof rawVolumes === 'object' && rawVolumes !== null) {
    const v = rawVolumes as Record<string, unknown>
    for (const bus of AUDIO_BUSES) {
      const n = v[bus]
      if (typeof n === 'number' && Number.isFinite(n)) volumes[bus] = clamp01(n)
    }
  }

  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

  return {
    theme,
    reducedMotion: bool(raw.reducedMotion, base.reducedMotion),
    highInk: bool(raw.highInk, base.highInk),
    assistMode: bool(raw.assistMode, base.assistMode),
    haptics: bool(raw.haptics, base.haptics),
    volumes,
    ambience,
    music: bool(raw.music, base.music),
    guides: bool(raw.guides, base.guides),
    leftHanded: bool(raw.leftHanded, base.leftHanded),
  }
}

export type ResolvedTheme = 'day' | 'night'

/** `auto` follows the system; day and night are the player's word and win. */
export function resolveTheme(theme: Settings['theme'], env: SettingsEnv = browserEnv): ResolvedTheme {
  if (theme === 'day' || theme === 'night') return theme
  return env.prefersDark() ? 'night' : 'day'
}

/**
 * Whether motion should actually run. The setting is a floor, not a veto: a player
 * who has asked the OS for less motion gets less motion even if the toggle is off.
 */
export function motionAllowed(settings: Settings, env: SettingsEnv = browserEnv): boolean {
  return !settings.reducedMotion && !env.prefersReducedMotion()
}

/** The document attributes tokens.css and the screens read. */
export interface ThemeAttributes {
  'data-theme': ResolvedTheme
  'data-high-ink': 'true' | 'false'
  'data-reduced-motion': 'true' | 'false'
  'data-assist': 'true' | 'false'
  'data-hand': 'left' | 'right'
}

export function themeAttributes(settings: Settings, env: SettingsEnv = browserEnv): ThemeAttributes {
  return {
    'data-theme': resolveTheme(settings.theme, env),
    'data-high-ink': settings.highInk ? 'true' : 'false',
    'data-reduced-motion': motionAllowed(settings, env) ? 'false' : 'true',
    'data-assist': settings.assistMode ? 'true' : 'false',
    'data-hand': settings.leftHanded ? 'left' : 'right',
  }
}

/**
 * Paint the settings onto `<html>`. Safe to call anywhere — it no-ops without a
 * document, so the store can call it during hydration under node or SSR.
 */
export function applySettings(settings: Settings, env: SettingsEnv = browserEnv, doc?: Document): void {
  const target = doc ?? (typeof document !== 'undefined' ? document : undefined)
  if (!target?.documentElement) return
  const attrs = themeAttributes(settings, env)
  const root = target.documentElement
  try {
    for (const [key, value] of Object.entries(attrs)) root.setAttribute(key, value)
    root.style.setProperty('color-scheme', attrs['data-theme'] === 'night' ? 'dark' : 'light')
  } catch {
    /* a locked-down document — the app still runs, it just looks like day */
  }
}

/**
 * Keep `theme: 'auto'` honest while the app is open. Returns an unsubscribe.
 * The shell wires this once; nothing else needs to think about it.
 */
export function watchSystemTheme(
  getSettings: () => Settings,
  env: SettingsEnv = browserEnv,
  doc?: Document,
): () => void {
  return env.onSystemThemeChange(() => {
    const settings = getSettings()
    if (settings.theme === 'auto') applySettings(settings, env, doc)
  })
}
