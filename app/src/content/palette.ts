/* PAPER PLANET — the content palette: every art fill is a token, or a documented mix of two tokens. */

/**
 * The Kami palette, mirrored from `styles/tokens.css` (day theme).
 * Art fills live inside SVG, so they must be literal hex — but nothing here is
 * invented: every value below is a token, and every other colour in the corpus
 * is produced by `mix()` from two of them.
 */
export const TOKEN = {
  paper0: '#FDF8F0',
  paper1: '#F7EDE0',
  paper2: '#EFE1CE',
  paper3: '#E0CDB2',
  paper4: '#C9B393',
  paperEdge: '#D6C3A6',
  paperBack: '#FBF7EF',

  ink: '#2E2438',
  inkSoft: '#6B5B7B',
  inkFaint: '#A294B0',

  beni: '#E4664F',
  beniDeep: '#C24732',
  beniSoft: '#F5C4B7',
  kincha: '#E0A340',
  kinchaDeep: '#B87D22',
  kinchaSoft: '#F6DFB2',
  matcha: '#7E9E7B',
  matchaDeep: '#5C7D59',
  matchaSoft: '#CFDECD',
  ai: '#4A6D8C',
  aiDeep: '#34526D',
  aiSoft: '#C3D5E2',
  murasaki: '#7B5EA7',
  murasakiDeep: '#5C4382',
  murasakiSoft: '#D5C8E8',
  sakura: '#EFC2C0',
  sakuraDeep: '#D9928F',
  goldLeaf: '#C9962E',
  goldHi: '#F5DC96',
} as const

export type TokenName = keyof typeof TOKEN

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
}

function hex2(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)))
  return v.toString(16).padStart(2, '0')
}

/** Linear blend of two hex colours. `t` = 0 keeps `a`, 1 becomes `b`. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  let out = '#'
  for (let i = 0; i < 3; i++) out += hex2(channel(a, i) * (1 - k) + channel(b, i) * k)
  return out
}

/** Push a colour toward sumi ink — the shadowed facet of a folded sheet. */
export function shade(c: string, t = 0.2): string {
  return mix(c, TOKEN.ink, t)
}

/** Lift a colour toward the topmost paper — the lit facet. */
export function tint(c: string, t = 0.3): string {
  return mix(c, TOKEN.paper0, t)
}

/**
 * The four values a folded creature is drawn from: the dyed face, the facet in
 * shadow, the facet catching light, and the pale underside.
 */
export interface Hue {
  base: string
  dark: string
  light: string
  pale: string
}

export function hue(base: string): Hue {
  return { base, dark: shade(base, 0.22), light: tint(base, 0.22), pale: tint(base, 0.62) }
}

/** Shared ink values for eyes, whiskers and cut lines. */
export const INK = TOKEN.ink
export const EYE_LIGHT = TOKEN.paper0
