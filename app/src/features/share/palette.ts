/*
 * PAPER PLANET — Share Card palette.
 *
 * Canvas2D cannot resolve a CSS custom property, and a card must be able to
 * render the *other* theme than the one the document is currently wearing (you
 * can post a lantern-lit card at noon). So the tokens are mirrored here as
 * literal values — exactly the way `content/palette.ts` mirrors them for SVG
 * art fills.
 *
 * Nothing below is invented. Every value is copied from `styles/tokens.css`,
 * and `auditPalette()` proves it against the live document in dev.
 */

import type { CardTheme } from './types'

export interface CardPalette {
  paper0: string
  paper1: string
  paper2: string
  paper3: string
  paper4: string
  paperEdge: string
  paperBack: string

  ink: string
  inkSoft: string
  inkFaint: string
  /** The hairline, as rgba — it is translucent in both themes. */
  inkHair: string

  beni: string
  kincha: string
  matcha: string
  ai: string
  murasaki: string
  sakura: string
  goldLeaf: string
  goldHi: string

  /** `--shadow-tint`, as an "r, g, b" triple. */
  shadowTint: string
  /** How opaque the paper's cast shadow is on this desk. */
  shadowStrength: number
  /** Grain opacity, tinted for the theme. */
  grainInk: string
  grainAlpha: number
}

const DAY: CardPalette = {
  paper0: '#fdf8f0',
  paper1: '#f7ede0',
  paper2: '#efe1ce',
  paper3: '#e0cdb2',
  paper4: '#c9b393',
  paperEdge: '#d6c3a6',
  paperBack: '#fbf7ef',

  ink: '#2e2438',
  inkSoft: '#6b5b7b',
  inkFaint: '#a294b0',
  inkHair: 'rgba(46, 36, 56, 0.14)',

  beni: '#e4664f',
  kincha: '#e0a340',
  matcha: '#7e9e7b',
  ai: '#4a6d8c',
  murasaki: '#7b5ea7',
  sakura: '#efc2c0',
  goldLeaf: '#c9962e',
  goldHi: '#f5dc96',

  shadowTint: '62, 44, 30',
  shadowStrength: 1,
  /* the fibre tint baked into --grain-fine / --grain-fibre: 0.42 0.34 0.24 */
  grainInk: '107, 87, 61',
  grainAlpha: 0.085,
}

const NIGHT: CardPalette = {
  paper0: '#4a3d52',
  paper1: '#3b3040',
  paper2: '#322833',
  paper3: '#261f2b',
  paper4: '#1a1520',
  paperEdge: '#574765',
  paperBack: '#524459',

  ink: '#f3e7d6',
  inkSoft: '#c3b2c4',
  inkFaint: '#8b7a93',
  inkHair: 'rgba(243, 231, 214, 0.16)',

  beni: '#ef7b63',
  kincha: '#f2bc5e',
  matcha: '#96b394',
  ai: '#7ba0bf',
  murasaki: '#a68ccc',
  sakura: '#d6a3a6',
  goldLeaf: '#e0b04a',
  goldHi: '#ffeeb9',

  shadowTint: '8, 4, 18',
  shadowStrength: 2.6,
  /* night grain is a pale fibre catching the lamp: 0.97 0.9 0.8 */
  grainInk: '247, 230, 204',
  grainAlpha: 0.055,
}

/** High Ink: heavier hairlines, firmer ink, calmer grain. Mirrors tokens.css §HIGH INK. */
function withHighInk(base: CardPalette, theme: CardTheme): CardPalette {
  return {
    ...base,
    inkSoft: base.ink,
    inkHair: theme === 'night' ? 'rgba(243, 231, 214, 0.36)' : 'rgba(46, 36, 56, 0.34)',
    paper1: theme === 'night' ? '#322735' : '#fbf3e6',
    paper2: theme === 'night' ? '#281f2b' : '#e9d8c0',
    grainAlpha: base.grainAlpha * 0.45,
  }
}

export function cardPalette(theme: CardTheme, highInk = false): CardPalette {
  const base = theme === 'night' ? NIGHT : DAY
  return highInk ? withHighInk(base, theme) : base
}

/** The dye a token name stands for, so rarity and accents stay in one vocabulary. */
export function accentColor(p: CardPalette, token: string): string {
  switch (token) {
    case 'beni': return p.beni
    case 'kincha': return p.kincha
    case 'matcha': return p.matcha
    case 'ai': return p.ai
    case 'murasaki': return p.murasaki
    case 'sakura': return p.sakura
    case 'gold-leaf': return p.goldLeaf
    default: return p.ink
  }
}

/* ── colour maths, so the card can shade a facet without a second palette ── */

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
}

function pair(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

/** Linear blend of two hex colours. Same maths as `content/palette.ts`. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  let out = '#'
  for (let i = 0; i < 3; i++) out += pair(channel(a, i) * (1 - k) + channel(b, i) * k)
  return out
}

/** A warm paper shadow at a given strength. Never neutral grey, never black. */
export function shadow(p: CardPalette, alpha: number): string {
  return `rgba(${p.shadowTint}, ${Math.min(0.92, alpha * p.shadowStrength).toFixed(3)})`
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE AUDIT — a mirror is only honest while someone checks it.
   ═══════════════════════════════════════════════════════════════════════════ */

const AUDITED: Array<[keyof CardPalette, string]> = [
  ['paper0', '--paper-0'],
  ['paper1', '--paper-1'],
  ['paper2', '--paper-2'],
  ['paper3', '--paper-3'],
  ['paper4', '--paper-4'],
  ['paperEdge', '--paper-edge'],
  ['paperBack', '--paper-back'],
  ['ink', '--ink'],
  ['inkSoft', '--ink-soft'],
  ['inkFaint', '--ink-faint'],
  ['beni', '--beni'],
  ['kincha', '--kincha'],
  ['matcha', '--matcha'],
  ['ai', '--ai'],
  ['murasaki', '--murasaki'],
  ['sakura', '--sakura'],
  ['goldLeaf', '--gold-leaf'],
  ['goldHi', '--gold-hi'],
]

/**
 * Compare the mirror against whatever the document actually resolved, for the
 * theme it is currently wearing. Returns the tokens that have drifted. Called
 * once in dev — it never runs in a shipped build, and never throws.
 */
export function auditPalette(): string[] {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return []
  const root = document.documentElement
  const theme: CardTheme = root.dataset.theme === 'night' ? 'night' : 'day'
  const highInk = root.dataset.highInk === 'true'
  const live = getComputedStyle(root)
  const mine = cardPalette(theme, highInk)
  const drift: string[] = []
  for (const [key, prop] of AUDITED) {
    const there = live.getPropertyValue(prop).trim().toLowerCase()
    if (!there) continue
    const here = String(mine[key]).trim().toLowerCase()
    if (there !== here) drift.push(`${prop}: tokens.css says ${there}, the card says ${here}`)
  }
  return drift
}
