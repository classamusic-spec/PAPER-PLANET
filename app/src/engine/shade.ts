// PAPER PLANET — per-facet lighting: Lambert key, hemispheric fill, sheen band, fold-root AO.

import type { PaperMaterial } from '../contracts'
import type { Lighting, PaperColors } from './types'
import { defaultLighting } from './types'
import { clamp, clamp01, finite, smoothstep } from './geom'

/** Fallback paper tones matching --paper-1 / --paper-back, so headless output is still on-brand. */
const FALLBACK_FRONT = 0xf7ede0
const FALLBACK_BACK = 0xfbf7ef

/** Result of shading one facet. Reused every frame; never allocated in the loop. */
export interface ShadeOut {
  fill: string
  stroke: string
  sheen: number
}

/* ── colour parsing ─────────────────────────────────────────────────────── */

function hasDoc(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement
}

let cssCache: CSSStyleDeclaration | null = null
function computed(): CSSStyleDeclaration | null {
  if (!hasDoc()) return null
  if (!cssCache) cssCache = getComputedStyle(document.documentElement)
  return cssCache
}

/** Drop the cached computed style — call after a theme swap. */
export function invalidateCssCache(): void {
  cssCache = null
}

function hex2(s: string, i: number): number {
  return parseInt(s.substr(i, 2), 16)
}

/**
 * Parse a CSS colour into 0..255 rgb. Understands #rgb, #rrggbb(aa),
 * rgb()/rgba(), hsl()/hsla() and `var(--token)` (resolved against the document
 * when one exists). Anything unparseable falls back to a paper tone rather than
 * throwing — a shipped glitch is worse than a slightly wrong dye.
 */
export function parseColor(css: string | undefined, fallback: number, depth = 0): number {
  if (!css) return fallback
  let s = css.trim()
  if (!s) return fallback

  if (s.startsWith('var(') && depth < 4) {
    const end = s.indexOf(')')
    const inner = s.slice(4, end < 0 ? s.length : end)
    const comma = inner.indexOf(',')
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim()
    const alt = comma < 0 ? '' : inner.slice(comma + 1).trim()
    const cs = computed()
    const resolved = cs ? cs.getPropertyValue(name).trim() : ''
    if (resolved) return parseColor(resolved, fallback, depth + 1)
    if (alt) return parseColor(alt, fallback, depth + 1)
    return fallback
  }

  if (s.charCodeAt(0) === 35) {
    s = s.slice(1)
    if (s.length === 3 || s.length === 4) {
      const r = parseInt(s[0] + s[0], 16)
      const g = parseInt(s[1] + s[1], 16)
      const b = parseInt(s[2] + s[2], 16)
      if (r === r && g === g && b === b) return (r << 16) | (g << 8) | b
      return fallback
    }
    if (s.length >= 6) {
      const r = hex2(s, 0)
      const g = hex2(s, 2)
      const b = hex2(s, 4)
      if (r === r && g === g && b === b) return (r << 16) | (g << 8) | b
    }
    return fallback
  }

  const open = s.indexOf('(')
  if (open > 0) {
    const fn = s.slice(0, open).trim().toLowerCase()
    const body = s.slice(open + 1, s.lastIndexOf(')') < 0 ? s.length : s.lastIndexOf(')'))
    const parts = body.split(/[\s,/]+/).filter((x) => x.length > 0)
    if (parts.length >= 3) {
      if (fn === 'rgb' || fn === 'rgba') {
        const r = channel(parts[0])
        const g = channel(parts[1])
        const b = channel(parts[2])
        return (r << 16) | (g << 8) | b
      }
      if (fn === 'hsl' || fn === 'hsla') {
        return hslToRgb(
          finite(parseFloat(parts[0]), 0),
          clamp01(finite(parseFloat(parts[1]), 0) / 100),
          clamp01(finite(parseFloat(parts[2]), 100) / 100),
        )
      }
    }
  }
  return fallback
}

function channel(tok: string): number {
  const v = finite(parseFloat(tok), 0)
  const n = tok.indexOf('%') >= 0 ? (v / 100) * 255 : v
  return clamp(Math.round(n), 0, 255)
}

function hslToRgb(h: number, s: number, l: number): number {
  const hh = ((h % 360) + 360) % 360 / 60
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) { r = c; g = x } else if (hh < 2) { r = x; g = c } else if (hh < 3) { g = c; b = x } else if (hh < 4) { g = x; b = c } else if (hh < 5) { r = x; b = c } else { r = c; b = x }
  return (
    (clamp(Math.round((r + m) * 255), 0, 255) << 16) |
    (clamp(Math.round((g + m) * 255), 0, 255) << 8) |
    clamp(Math.round((b + m) * 255), 0, 255)
  )
}

/* ── lighting from CSS custom properties ────────────────────────────────── */

function readVar(name: string, dflt: number): number {
  const cs = computed()
  if (!cs) return dflt
  const raw = cs.getPropertyValue(name).trim()
  if (!raw) return dflt
  const v = parseFloat(raw)
  return v === v ? v : dflt
}

/**
 * Read --light-key / --light-fill / --light-sheen / --light-ao from the document
 * root. Headless (tests, workers) keeps the defaults, which are the day-theme
 * token values.
 */
export function readLighting(into?: Lighting): Lighting {
  const l = into ?? defaultLighting()
  const d = defaultLighting()
  l.key = clamp(readVar('--light-key', d.key), 0, 2)
  l.fill = clamp(readVar('--light-fill', d.fill), 0, 2)
  l.sheen = clamp(readVar('--light-sheen', d.sheen), 0, 2)
  l.ao = clamp(readVar('--light-ao', d.ao), 0, 1.5)
  return l
}

/* ── the shader ─────────────────────────────────────────────────────────── */

const SHOULDER = 0.84
const CEIL = 0.985
const FLOOR = 0.055

export class Shader {
  light: Lighting = defaultLighting()
  colors: PaperColors = {
    fr: 0, fg: 0, fb: 0, br: 0, bg: 0, bb: 0, foil: 0,
    source: { front: '#f7ede0', back: '#fbf7ef' },
  }
  /** Hairline cut-edge stroke width in CSS pixels. */
  strokeWidth = 0.75
  /** Accessibility: heavier outlines and stronger separation. */
  highInk = false

  private cache = new Map<number, string>()
  private out: ShadeOut = { fill: '#f7ede0', stroke: '#d6c3a6', sheen: 0 }

  setMaterial(m: PaperMaterial): void {
    const front = parseColor(m.front, FALLBACK_FRONT)
    const back = parseColor(m.back, FALLBACK_BACK)
    const c = this.colors
    c.source = m
    c.foil = clamp01(finite(m.foil ?? 0, 0))
    // Store linear-ish (gamma 2.0). Cheap, and the shading reads correctly.
    c.fr = srgbToLin(((front >> 16) & 255) / 255)
    c.fg = srgbToLin(((front >> 8) & 255) / 255)
    c.fb = srgbToLin((front & 255) / 255)
    c.br = srgbToLin(((back >> 16) & 255) / 255)
    c.bg = srgbToLin(((back >> 8) & 255) / 255)
    c.bb = srgbToLin((back & 255) / 255)
    this.cache.clear()
  }

  /** Re-read the CSS lighting variables and re-resolve any var() paper colours. */
  refresh(): void {
    invalidateCssCache()
    readLighting(this.light)
    this.setMaterial(this.colors.source)
  }

  /**
   * Shade one facet.
   *
   * `n` is the unit world normal, `v` the unit direction toward the eye.
   * `occl` is the fold-root occlusion from foldOcclusion(). The returned object
   * is reused — copy the strings out immediately (the renderer does).
   */
  shade(
    nx: number, ny: number, nz: number,
    vx: number, vy: number, vz: number,
    occl: number,
  ): ShadeOut {
    const L = this.light
    // Always light the face we can actually see.
    let fx = nx
    let fy = ny
    let fz = nz
    const facing = fx * vx + fy * vy + fz * vz
    const isBack = facing < 0
    if (isBack) {
      fx = -fx
      fy = -fy
      fz = -fz
    }

    const lambert = Math.max(0, fx * L.lx + fy * L.ly + fz * L.lz)
    // y is DOWN, so an up-facing normal has negative y and catches the sky.
    const hemi = 0.5 - 0.5 * fy

    // Specular sheen: a grazing-angle band, not a rim light. Paper is a rough
    // dielectric — it only glints when the light rakes across the fibres.
    let hx = L.lx + vx
    let hy = L.ly + vy
    let hz = L.lz + vz
    const hl = Math.sqrt(hx * hx + hy * hy + hz * hz)
    if (hl > 1e-6) {
      hx /= hl
      hy /= hl
      hz /= hl
    }
    const ndh = Math.max(0, fx * hx + fy * hy + fz * hz)
    const spec = ndh * ndh * ndh * ndh * ndh * ndh * ndh * ndh * ndh * ndh * ndh * ndh
    const graze = 1 - Math.abs(Math.min(1, Math.abs(facing)))
    const fres = graze * graze * graze
    const foil = this.colors.foil
    let sheen = clamp01(L.sheen * (0.62 * fres + (0.9 + foil * 2.4) * spec) * (1 + foil))

    const ao = clamp01(occl)
    let lum = L.ambient + L.key * lambert + L.fill * hemi
    lum *= 1 - ao * 0.72
    // Bake part of the sheen into the fill so a renderer that ignores the
    // sheen channel still gets paper that catches the light.
    lum += sheen * 0.45

    const c = this.colors
    // Warm key, cool fill: the tint separation is what stops paper reading as plastic.
    const warm = 1 + 0.055 * lambert * L.key
    const cool = 1 + 0.05 * hemi * L.fill
    const base0 = isBack ? c.br : c.fr
    const base1 = isBack ? c.bg : c.fg
    const base2 = isBack ? c.bb : c.fb

    const r = shoulder(base0 * lum * warm)
    const g = shoulder(base1 * lum)
    const b = shoulder(base2 * lum * cool)

    const ri = quant(r)
    const gi = quant(g)
    const bi = quant(b)
    const key = (ri << 16) | (gi << 8) | bi
    const o = this.out
    o.fill = this.hex(key)

    // The cut edge: the same dye, pushed down and slightly toward the ink hue.
    const k = this.highInk ? 0.58 : 0.76
    const sk =
      (quant(r * k) << 16) | (quant(g * k * 0.985) << 8) | quant(b * k * 1.03)
    o.stroke = this.hex(sk)
    if (this.highInk) sheen *= 0.7
    o.sheen = sheen
    return o
  }

  isBackFacing(nx: number, ny: number, nz: number, vx: number, vy: number, vz: number): boolean {
    return nx * vx + ny * vy + nz * vz < 0
  }

  /** Packed-rgb -> '#rrggbb', memoised. After a second of play this never misses. */
  hex(packed: number): string {
    const hit = this.cache.get(packed)
    if (hit !== undefined) return hit
    const s = '#' + (packed | 0x1000000).toString(16).slice(1)
    if (this.cache.size < 4096) this.cache.set(packed, s)
    return s
  }
}

function srgbToLin(c: number): number {
  return c * c
}

/** Soft highlight roll-off, clamped short of pure white — the brand forbids #FFF. */
function shoulder(x: number): number {
  const v = x <= 0 ? 0 : Math.sqrt(x)
  if (v <= SHOULDER) return v < FLOOR ? FLOOR : v
  const t = (v - SHOULDER) / (1 - SHOULDER)
  return SHOULDER + (CEIL - SHOULDER) * (1 - Math.exp(-t * 1.9))
}

function quant(v: number): number {
  const n = (v * 255 + 0.5) | 0
  return n < 0 ? 0 : n > 255 ? 255 : n
}

/* ── ambient occlusion at the fold roots ────────────────────────────────── */

/** How far from a crease the seam shadow reaches, in model units. */
export const AO_RADIUS = 92

/**
 * Darkening where a flap meets its parent.
 *
 * Three terms, all physical:
 *  - the seam itself: the closer a piece of paper sits to its own hinge, the
 *    deeper into the crevice it is, and a tightly closed fold traps more shadow;
 *  - the pocket: how many *closed* folds sit above it. A scored-but-flat sheet
 *    has none, which is why a crease line does not darken until you fold it;
 *  - stacking: paper with many sheets over it gets less bounce light.
 */
export function foldOcclusion(
  rootDist: number,
  nodeAngle: number,
  pocketDepth: number,
  layersAbove: number,
  aoStrength: number,
): number {
  const near = 1 - clamp01(finite(rootDist, AO_RADIUS) / AO_RADIUS)
  const seam = near * near * (0.35 + 0.65 * near)
  const closure = closureOf(nodeAngle)
  const depth = 1 - 1 / (1 + 0.42 * Math.max(0, pocketDepth))
  const stack = clamp01(Math.max(0, layersAbove) / 6)
  return clamp01(aoStrength * (0.78 * seam * closure + 0.3 * depth + 0.34 * stack))
}

/** How closed a hinge is, 0..1. Drives both the seam shadow and pocket depth. */
export function closureOf(angle: number): number {
  return smoothstep(0.25, Math.PI, Math.abs(finite(angle, 0)))
}
