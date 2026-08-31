/*
 * PAPER PLANET — the mark, on canvas.
 *
 * The card is the logotype in the wild, so the lockup is rebuilt from the same
 * geometry `ui/Logotype.tsx` uses rather than approximated: the crane's seven
 * cut facets, the paper disc with its 34° crease, and the A of PLANET punched
 * out of a folded-paper world.
 *
 * The only thing left behind is `font-variation-settings: SOFT 40, WONK 1` —
 * Canvas2D takes a CSS font shorthand and the shorthand has no axis syntax.
 * Fraunces 900 without the axes is the same letterforms, very slightly less
 * quirky, and it is the closest a bitmap can honestly get.
 */

import { CRANE_FACETS } from '../../ui/crane'
import type { CardPalette } from './palette'
import { mix, shadow } from './palette'
import { drawText, measure, type FontSpec } from './text'

/* apex, two legs, one crossbar — an A, punched out of the disc. From ui/Logotype.tsx. */
const A_CUT = 'M43 9h14L76 88H62L50 34 38 88H24Z' + 'M31 56.5h38l4.4 13H26.6Z'

const WORD: FontSpec = { family: 'display', size: 100, weight: 900, tracking: -0.03 }

/* ═══════════════════════════════════════════════════════════════════════════
   THE CRANE, and the disc it sits on
   ═══════════════════════════════════════════════════════════════════════════ */

/** The mascot alone, in a 120×100 sheet scaled to `w`. */
export function paintCrane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  p: CardPalette,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w / 120, w / 120)
  for (const facet of CRANE_FACETS) {
    ctx.fillStyle =
      facet.shade === 'deep'
        ? mix(color, p.ink, 0.22)
        : facet.shade === 'soft'
          ? mix(color, p.paper0, 0.18)
          : color
    ctx.fill(new Path2D(facet.d))
  }
  ctx.restore()
}

/** The app icon: a crane on a paper disc, one crease crossing it at 34°. */
export function paintCraneMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  p: CardPalette,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 100, size / 100)

  const disc = new Path2D()
  disc.arc(50, 50, 47, 0, Math.PI * 2)

  ctx.fillStyle = p.paper1
  ctx.fill(disc)

  ctx.save()
  ctx.clip(disc)
  ctx.globalAlpha = 0.55
  ctx.fillStyle = p.paper3
  ctx.fill(new Path2D('M-14 96 L118 7 L118 118 L-14 118 Z'))
  ctx.globalAlpha = 1
  ctx.fillStyle = p.paperEdge
  ctx.fill(new Path2D('M-14 96 L118 7 L119 9 L-13 98 Z'))
  ctx.restore()

  ctx.strokeStyle = p.paperEdge
  ctx.lineWidth = 1.6
  ctx.stroke(disc)

  ctx.translate(11, 18)
  ctx.scale(0.64, 0.64)
  for (const facet of CRANE_FACETS) {
    ctx.fillStyle =
      facet.shade === 'deep'
        ? mix(p.beni, p.ink, 0.28)
        : facet.shade === 'soft'
          ? mix(p.beni, p.paper0, 0.16)
          : p.beni
    ctx.fill(new Path2D(facet.d))
  }
  ctx.restore()
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE WORDMARK
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The folded-paper disc standing in for the A of PLANET. The letter is negative
 * space: the disc is wound one way and the A the other, so a single non-zero
 * fill punches the world through.
 */
function paintPlanetGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ink: string, lit: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 100, size / 100)

  const world = new Path2D()
  world.arc(50, 50, 49, 0, Math.PI * 2, true)
  world.addPath(new Path2D(A_CUT))
  ctx.fillStyle = ink
  ctx.fill(world, 'nonzero')

  /* The lit half of the mountain fold and the ridge down its centre. Both are
     sub-pixel under about 40px, where they stop reading as a fold and start
     reading as dirt in the letter — so under 40px the world is simply solid. */
  if (size >= 40) {
    ctx.save()
    ctx.clip(world, 'nonzero')
    ctx.globalAlpha = 0.15
    ctx.fillStyle = lit
    ctx.fill(new Path2D('M50 1a49 49 0 0 0 0 98Z'))
    ctx.globalAlpha = 0.55
    ctx.fillRect(49, 1, 1.9, 98)
    ctx.restore()
  }

  ctx.restore()
}

export interface WordmarkMetrics {
  width: number
  /** Distance from the baseline to the top of the caps. */
  ascent: number
}

function wordFont(size: number): FontSpec {
  return { ...WORD, size }
}

export function measureWordmark(ctx: CanvasRenderingContext2D, size: number): WordmarkMetrics {
  const f = wordFont(size)
  const paper = measure(ctx, 'PAPER', f)
  const pl = measure(ctx, 'PL', f)
  const net = measure(ctx, 'NET', f)
  const disc = size * 0.84 + size * 0.07
  return { width: paper + size * 0.26 + pl + disc + net, ascent: size * 0.78 }
}

/**
 * `PAPER PLANET`, set the way the brand sets it. Above 44px the A of PAPER also
 * carries its fold crease; below that the band would read as dirt, so it is left
 * off — a mark that only works large is not a mark.
 */
export function paintWordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  size: number,
  p: CardPalette,
): number {
  const f = wordFont(size)
  const ink = p.ink
  let pen = x

  const wP = measure(ctx, 'P', f)
  const wPA = measure(ctx, 'PA', f)
  drawText(ctx, 'PAPER', pen, baseline, f, ink)

  if (size >= 44) {
    /* the crease through the A: shadow on one side, catch-light on the other */
    const left = pen + wP
    const width = wPA - wP
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, baseline - size * 0.82, width, size * 0.9)
    ctx.clip()
    const g = ctx.createLinearGradient(left, baseline, left + width, baseline - size * 0.7)
    g.addColorStop(0.436, mix(p.paper1, p.ink, 0.1))
    g.addColorStop(0.464, mix(p.ink, p.paper4, 0.42))
    g.addColorStop(0.484, mix(p.ink, p.paper1, 0.1))
    drawText(ctx, 'PAPER', pen, baseline, f, g)
    ctx.restore()
  }

  pen += measure(ctx, 'PAPER', f) + size * 0.26
  drawText(ctx, 'PL', pen, baseline, f, ink)
  pen += measure(ctx, 'PL', f) + size * 0.035

  const disc = size * 0.84
  paintPlanetGlyph(ctx, pen, baseline + size * 0.06 - disc, disc, ink, p.paper1)
  pen += disc + size * 0.035

  drawText(ctx, 'NET', pen, baseline, f, ink)
  return pen + measure(ctx, 'NET', f) - x
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE LOCKUP — what actually signs a card
   ═══════════════════════════════════════════════════════════════════════════ */

const TAG: FontSpec = { family: 'text', size: 18, weight: 800, tracking: 0.14 }

export interface LockupOptions {
  /** Wordmark size in px. */
  size: number
  /** The hairline rule and FOLD · BREATHE · COME ALIVE beneath the words. */
  tagline?: boolean
  /** Drop the crane disc to the left of the words. */
  mark?: boolean
}

export interface LockupBox {
  width: number
  height: number
}

export function measureLockup(ctx: CanvasRenderingContext2D, o: LockupOptions): LockupBox {
  const word = measureWordmark(ctx, o.size)
  const markW = o.mark ? o.size * 1.34 + o.size * 0.34 : 0
  const tagH = o.tagline ? o.size * 0.3 + Math.max(11, o.size * 0.28) * 1.9 : 0
  return { width: word.width + markW, height: o.size * 0.86 + tagH }
}

/**
 * Draw the lockup with its top-left at (x, y), centred on `x` when `align` is
 * `center`. Returns the box it occupied.
 */
export function paintLockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: CardPalette,
  o: LockupOptions,
  align: 'left' | 'center' = 'left',
): LockupBox {
  const box = measureLockup(ctx, o)
  const left = align === 'center' ? x - box.width / 2 : x
  const baseline = y + o.size * 0.78

  let pen = left
  if (o.mark) {
    const d = o.size * 1.34
    ctx.save()
    ctx.shadowColor = shadow(p, 0.22)
    ctx.shadowBlur = o.size * 0.18
    ctx.shadowOffsetY = o.size * 0.1
    paintCraneMark(ctx, pen, baseline - d * 0.82, d, p)
    ctx.restore()
    pen += d + o.size * 0.34
  }
  paintWordmark(ctx, pen, baseline, o.size, p)

  if (o.tagline) {
    const ruleY = Math.round(baseline + o.size * 0.3) + 0.5
    ctx.save()
    ctx.strokeStyle = p.inkHair
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, ruleY)
    ctx.lineTo(left + box.width, ruleY)
    ctx.stroke()
    ctx.restore()
    const tag: FontSpec = { ...TAG, size: Math.max(11, o.size * 0.28) }
    drawText(
      ctx,
      'FOLD · BREATHE · COME ALIVE',
      left + box.width / 2,
      ruleY + tag.size * 1.5,
      tag,
      p.inkSoft,
      'center',
    )
  }

  return box
}
