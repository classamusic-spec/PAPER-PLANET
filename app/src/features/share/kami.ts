/*
 * PAPER PLANET — the Kami, painted onto the card.
 *
 * `<KamiMark>` is React and SVG; a share card is a bitmap. Rasterising the
 * component would mean serialising SVG to a data URI and waiting on an `<img>` —
 * a round-trip that drops the self-hosted faces and every CSS custom property
 * with it. So the art is drawn straight to the context, following
 * `screens/codex/KamiMark.tsx` decision for decision:
 *
 *   · `pts` → a filled polygon, hairline-stroked unless `noStroke`
 *   · `circle` → the same, as an arc
 *   · `line` → stroked in its own fill at 3.2, round-capped, never outlined
 *   · gold → a foil gradient clipped to the union of every filled shape
 *
 * The one thing the card does that the Codex does not is *fit*. Art is authored
 * in a 0..200 box (contracts §3) but almost nothing fills it, and a species that
 * happens to sit in one corner of its box would be posted as a small creature
 * floating in a large margin. So the card measures the ink and frames that.
 */

import type { ArtPoly } from '../../contracts'
import type { CardPalette } from './palette'
import { shadow } from './palette'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** SVG `points` → a path. Tolerates both "x,y x,y" and "x y x y". */
function polyPath(pts: string): Path2D | null {
  const n = numbers(pts)
  if (n.length < 6) return null
  const path = new Path2D()
  path.moveTo(n[0], n[1])
  for (let i = 2; i + 1 < n.length; i += 2) path.lineTo(n[i], n[i + 1])
  path.closePath()
  return path
}

function numbers(pts: string): number[] {
  return pts.trim().split(/[\s,]+/).map(Number)
}

/** Everything that can act as a clip: filled areas only, never a drawn line. */
function unionPath(art: readonly ArtPoly[]): Path2D {
  const union = new Path2D()
  for (const poly of art) {
    if (poly.circle) {
      const [cx, cy, r] = poly.circle
      const sub = new Path2D()
      sub.arc(cx, cy, r, 0, Math.PI * 2)
      union.addPath(sub)
    } else if (poly.pts) {
      const sub = polyPath(poly.pts)
      if (sub) union.addPath(sub)
    }
  }
  return union
}

/** The ink of a creature, in art units. Half a stroke of slack all round. */
export function artBounds(art: readonly ArtPoly[]): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const hit = (x: number, y: number, pad = 0): void => {
    x0 = Math.min(x0, x - pad)
    y0 = Math.min(y0, y - pad)
    x1 = Math.max(x1, x + pad)
    y1 = Math.max(y1, y + pad)
  }
  for (const poly of art) {
    if (poly.circle) hit(poly.circle[0], poly.circle[1], poly.circle[2] + 0.8)
    else if (poly.line) {
      hit(poly.line[0], poly.line[1], 1.6)
      hit(poly.line[2], poly.line[3], 1.6)
    } else if (poly.pts) {
      const n = numbers(poly.pts)
      for (let i = 0; i + 1 < n.length; i += 2) hit(n[i], n[i + 1], 0.8)
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 200, h: 200 }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }
}

export interface KamiPaintOptions {
  /** Lay gold leaf over the whole model. */
  gold?: boolean
  /** Hairline edge colour. Omit for none. */
  hair?: string
  /** Hairline weight, in art units. High Ink asks for more. */
  hairWidth?: number
}

/** Draw the art in art coordinates. The caller owns the transform. */
function paintArt(
  ctx: CanvasRenderingContext2D,
  art: readonly ArtPoly[],
  bounds: Rect,
  p: CardPalette,
  opts: KamiPaintOptions,
): void {
  const hair = opts.hair ?? p.inkHair
  const hairWidth = opts.hairWidth ?? 1.5
  ctx.lineJoin = 'round'

  for (const poly of art) {
    if (poly.line) {
      const [x1, y1, x2, y2] = poly.line
      ctx.save()
      ctx.strokeStyle = poly.fill
      ctx.lineWidth = 3.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.restore()
      continue
    }

    let path: Path2D | null = null
    if (poly.circle) {
      const [cx, cy, r] = poly.circle
      path = new Path2D()
      path.arc(cx, cy, r, 0, Math.PI * 2)
    } else if (poly.pts) {
      path = polyPath(poly.pts)
    }
    if (!path) continue

    ctx.fillStyle = poly.fill
    ctx.fill(path)
    if (!poly.noStroke && hair) {
      ctx.strokeStyle = hair
      ctx.lineWidth = hairWidth
      ctx.stroke(path)
    }
  }

  if (opts.gold) {
    /* the same four-stop foil the Codex lays over a golden fold, run across the
       creature's own diagonal rather than the empty box it was authored in */
    const foil = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h)
    foil.addColorStop(0, hexA(p.goldHi, 0.9))
    foil.addColorStop(0.42, hexA(p.goldLeaf, 0.55))
    foil.addColorStop(0.7, hexA(p.goldHi, 0.85))
    foil.addColorStop(1, hexA(p.goldLeaf, 0.5))
    ctx.save()
    ctx.clip(unionPath(art))
    ctx.fillStyle = foil
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)
    ctx.restore()
  }
}

/**
 * Paint one creature as large as it will go inside `box`, keeping its aspect,
 * and return the rectangle its ink actually occupies — which is where a shadow
 * belongs and how much room the next thing has.
 */
export function paintKami(
  ctx: CanvasRenderingContext2D,
  art: readonly ArtPoly[],
  box: Rect,
  p: CardPalette,
  opts: KamiPaintOptions = {},
): Rect {
  const b = artBounds(art)
  const scale = Math.min(box.w / b.w, box.h / b.h)
  const drawn: Rect = {
    x: box.x + (box.w - b.w * scale) / 2,
    y: box.y + (box.h - b.h * scale) / 2,
    w: b.w * scale,
    h: b.h * scale,
  }

  ctx.save()
  ctx.translate(drawn.x, drawn.y)
  ctx.scale(scale, scale)
  ctx.translate(-b.x, -b.y)
  paintArt(ctx, art, b, p, { ...opts, hairWidth: (opts.hairWidth ?? 1.5) / Math.max(0.35, scale / 3) })
  ctx.restore()

  return drawn
}

/** `#rrggbb` at an alpha, without dragging in a colour library. */
function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The shadow a paper model casts on the sheet it stands on: warm, soft, and
 * offset down and right, exactly where every other shadow in the app falls.
 */
export function paintContactShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  width: number,
  p: CardPalette,
): void {
  ctx.save()
  ctx.translate(cx + width * 0.045, baseY)
  ctx.scale(1, 0.17)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.56)
  g.addColorStop(0, shadow(p, 0.32))
  g.addColorStop(0.5, shadow(p, 0.15))
  g.addColorStop(1, shadow(p, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, width * 0.56, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** A soft bloom behind a golden fold, so gold leaf reads as leaf and not paint. */
export function paintFoilBloom(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  p: CardPalette,
): void {
  const g = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius)
  g.addColorStop(0, hexA(p.goldHi, 0.46))
  g.addColorStop(0.45, hexA(p.goldLeaf, 0.17))
  g.addColorStop(1, hexA(p.goldLeaf, 0))
  ctx.save()
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
