/*
 * PAPER PLANET — the Share Card composer.
 *
 * A card is a sheet of paper lying on the desk, photographed from above. Every
 * value is a frozen token, every shadow is warm and directional, and the whole
 * thing is laid out from the outside in: the desk, the sheet, its fold, then the
 * type — set to a baseline, the way a letterpress broadside is.
 *
 * Layout is measured, never assumed. The type block is set first and the
 * creature is given whatever height is left, so a long name or a long fact makes
 * the Kami a little smaller rather than pushing anything off the paper.
 */

import { edgePath, hashSeed, mulberry32, stableTilt } from '../../ui/paperShapes'
import { paintContactShadow, paintFoilBloom, paintKami } from './kami'
import { paintLockup, measureLockup } from './logotype'
import { accentColor, cardPalette, shadow, type CardPalette } from './palette'
import { layGrain } from './texture'
import { drawBlock, drawText, fitBlock, fitLine, type Block, type FontSpec } from './text'
import { CARD_SIZE, type CardData, type CardSpec } from './types'

/* ── the shape of a card, in design units ────────────────────────────────── */

interface Metrics {
  w: number
  h: number
  /** How much desk shows around the sheet. */
  desk: number
  /** Content inset from the sheet's own edge. */
  pad: number
  label: number
  nameSize: number
  nameMin: number
  binoSize: number
  factSize: number
  factMin: number
  factLines: number
  lockup: number
  minKami: number
  /** Gap between the creature and the name. */
  rise: number
}

const METRICS: Record<'square' | 'story', Metrics> = {
  square: {
    w: 1080, h: 1080, desk: 38, pad: 66,
    label: 21, nameSize: 84, nameMin: 52, binoSize: 30,
    factSize: 27, factMin: 22, factLines: 4,
    lockup: 30, minKami: 296, rise: 34,
  },
  story: {
    w: 1080, h: 1920, desk: 44, pad: 74,
    label: 24, nameSize: 108, nameMin: 62, binoSize: 37,
    factSize: 33, factMin: 26, factLines: 5,
    lockup: 38, minKami: 440, rise: 48,
  },
}

interface Box { x: number; y: number; w: number; h: number }

/* ═══════════════════════════════════════════════════════════════════════════
   THE DESK AND THE SHEET
   ═══════════════════════════════════════════════════════════════════════════ */

/** The desk the card lies on: paper's darkest value, lit from above-left. */
function paintDesk(ctx: CanvasRenderingContext2D, m: Metrics, p: CardPalette, night: boolean): void {
  ctx.fillStyle = p.paper4
  ctx.fillRect(0, 0, m.w, m.h)

  /* Night is not dark mode: it is a warm lamp pooling on a dark desk (§4.3). */
  const pool = ctx.createRadialGradient(m.w * 0.5, m.h * 0.42, 0, m.w * 0.5, m.h * 0.42, m.h * 0.78)
  if (night) {
    pool.addColorStop(0, hexA(p.kincha, 0.16))
    pool.addColorStop(0.55, hexA(p.kincha, 0.05))
    pool.addColorStop(1, hexA(p.kincha, 0))
  } else {
    pool.addColorStop(0, hexA(p.paper0, 0.2))
    pool.addColorStop(1, hexA(p.paper0, 0))
  }
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, m.w, m.h)

  layGrain(ctx, p, { x: 0, y: 0, w: m.w, h: m.h }, 0.8)
}

/** The boundary of the sheet: a mould-made deckle, generated from the seed. */
function sheetPath(box: Box, seed: string): Path2D {
  const d = edgePath(box.w, box.h, seed, 'deckle', 22)
  const path = new Path2D()
  const sub = new Path2D(d)
  const m = new DOMMatrix().translateSelf(box.x, box.y)
  path.addPath(sub, m)
  return path
}

/**
 * One fold across the sheet at the icon's 34°, lit above and shadowed below,
 * so the card is a folded thing rather than a printed rectangle.
 */
function paintCrease(ctx: CanvasRenderingContext2D, box: Box, p: CardPalette, at: number): void {
  const slope = Math.tan((34 * Math.PI) / 180)
  const x0 = box.x - 40
  const x1 = box.x + box.w + 40
  const y0 = box.y + box.h * at
  const y1 = y0 - (x1 - x0) * slope

  const under = new Path2D()
  under.moveTo(x0, y0)
  under.lineTo(x1, y1)
  under.lineTo(x1, box.y + box.h + 60)
  under.lineTo(x0, box.y + box.h + 60)
  under.closePath()

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = p.paper2
  ctx.fill(under)
  ctx.globalAlpha = 1

  /* the crease line itself, and the catch-light riding on top of it */
  ctx.lineWidth = 2
  ctx.strokeStyle = hexA(p.paperEdge, 0.85)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()

  ctx.lineWidth = 3
  ctx.strokeStyle = hexA(p.paper0, 0.5)
  ctx.beginPath()
  ctx.moveTo(x0, y0 - 3)
  ctx.lineTo(x1, y1 - 3)
  ctx.stroke()
  ctx.restore()
}

/** Lay the sheet down: shadow, paper, fibre, fold, rim. Leaves it clipped. */
function paintSheet(
  ctx: CanvasRenderingContext2D,
  box: Box,
  p: CardPalette,
  seed: string,
  creaseAt: number,
): Path2D {
  const path = sheetPath(box, seed)

  ctx.save()
  ctx.shadowColor = shadow(p, 0.2)
  ctx.shadowBlur = 42
  ctx.shadowOffsetX = 7
  ctx.shadowOffsetY = 14
  ctx.fillStyle = p.paper1
  ctx.fill(path)
  ctx.restore()

  ctx.save()
  ctx.clip(path)
  ctx.fillStyle = p.paper1
  ctx.fillRect(box.x, box.y, box.w, box.h)
  paintCrease(ctx, box, p, creaseAt)
  layGrain(ctx, p, box, 1)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = p.paperEdge
  ctx.lineWidth = 1.4
  ctx.stroke(path)
  ctx.restore()

  return path
}

function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, p: CardPalette, strong = false): void {
  ctx.save()
  ctx.strokeStyle = strong ? hexA(p.inkFaint, 0.5) : p.inkHair
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, Math.round(y) + 0.5)
  ctx.lineTo(x + w, Math.round(y) + 0.5)
  ctx.stroke()
  ctx.restore()
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CARD
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Compose one card into a context already sized to `spec`. Fonts must be ready
 * before this is called — see `fontsReady()`.
 */
export function paintCard(ctx: CanvasRenderingContext2D, data: CardData, spec: CardSpec): void {
  const m = METRICS[spec.shape]
  const p = cardPalette(spec.theme, spec.highInk)
  const night = spec.theme === 'night'

  ctx.save()
  ctx.scale(spec.pixelRatio, spec.pixelRatio)
  ctx.clearRect(0, 0, m.w, m.h)

  paintDesk(ctx, m, p, night)

  const sheet: Box = { x: m.desk, y: m.desk, w: m.w - m.desk * 2, h: m.h - m.desk * 2 }
  const creaseAt = data.layout === 'crowd' ? 0.74 : 0.62
  const path = paintSheet(ctx, sheet, p, data.seed, creaseAt)

  ctx.save()
  ctx.clip(path)
  const content: Box = {
    x: sheet.x + m.pad,
    y: sheet.y + m.pad,
    w: sheet.w - m.pad * 2,
    h: sheet.h - m.pad * 2,
  }
  if (data.layout === 'crowd') paintCrowd(ctx, data, m, p, content, spec)
  else paintSpecimen(ctx, data, m, p, content, spec)
  ctx.restore()

  ctx.restore()
}

const LABEL = (size: number): FontSpec => ({ family: 'text', size, weight: 800, tracking: 0.14 })

/** The two tracked labels along the top, and the rule beneath them. */
function paintHeader(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Box,
): number {
  const f = LABEL(m.label)
  const baseline = c.y + m.label

  if (data.stamp) {
    const dot = m.label * 0.42
    ctx.save()
    ctx.fillStyle = accentColor(p, data.stamp.token)
    ctx.beginPath()
    ctx.arc(c.x + dot / 2, baseline - m.label * 0.3, dot / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawText(ctx, data.stamp.label.toUpperCase(), c.x + dot + m.label * 0.55, baseline, f, p.inkSoft)
  }
  if (data.tag) drawText(ctx, data.tag.toUpperCase(), c.x + c.w, baseline, f, p.inkSoft, 'right')

  const ruleY = baseline + m.label * 0.95
  rule(ctx, c.x, ruleY, c.w, p)
  return ruleY
}

/** The maker's line: what it was folded from, and the mark that signs it. */
function paintFooter(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Box,
  spec: CardSpec,
): number {
  const tagline = spec.shape === 'story'
  const lock = measureLockup(ctx, { size: m.lockup, tagline, mark: true })
  const provFont: FontSpec = { family: 'text', size: Math.round(m.label * 1.02), weight: 600 }
  const lead = Math.round(provFont.size * 1.42)
  const provH = data.provenance.length * lead

  const height = Math.max(lock.height, provH)
  const bottom = c.y + c.h
  const top = bottom - height

  const lockLeft = c.x + c.w - lock.width
  paintLockup(ctx, lockLeft, top + (height - lock.height) / 2, p, { size: m.lockup, tagline, mark: true })

  let y = top + (height - provH) / 2 + provFont.size
  for (const line of data.provenance) {
    drawText(ctx, line, c.x, y, provFont, p.inkFaint)
    y += lead
  }

  const ruleY = top - m.label * 1.5
  rule(ctx, c.x, ruleY, c.w, p)
  return ruleY
}

/* ── one Kami, on its own ────────────────────────────────────────────────── */

function paintSpecimen(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Box,
  spec: CardSpec,
): void {
  const headRule = paintHeader(ctx, data, m, p, c)
  const footRule = paintFooter(ctx, data, m, p, c, spec)

  const top = headRule + m.rise * 1.1
  const bottom = footRule - m.rise * 0.9

  /* set the type first — the creature takes what is left */
  const nameFont = fitLine(
    ctx,
    data.title,
    { family: 'display', size: m.nameSize, weight: 800, tracking: -0.02 },
    c.w,
    m.nameMin,
  )
  const binoFont: FontSpec = { family: 'display', size: m.binoSize, weight: 400, italic: true }
  const factFont: FontSpec = { family: 'text', size: m.factSize, weight: 400 }

  const nameCap = nameFont.size * 0.74
  const binoLead = Math.round(binoFont.size * 1.62)

  let fact: Block | null = data.fact
    ? fitBlock(ctx, data.fact, factFont, c.w, m.factLines, m.factMin, 1.52)
    : null
  const factGap = Math.round(binoFont.size * 1.15)

  const textH = (f: Block | null): number => nameCap + binoLead + (f ? factGap + f.height : 0)
  /* the codex fact rides along only if the creature still has room to be seen */
  if (fact && bottom - top - textH(fact) - m.rise < m.minKami) {
    const tighter = data.fact
      ? fitBlock(ctx, data.fact, factFont, c.w, Math.max(2, m.factLines - 1), m.factMin, 1.46)
      : null
    fact = tighter && bottom - top - textH(tighter) - m.rise >= m.minKami ? tighter : null
  }

  const zoneH = bottom - top - textH(fact) - m.rise
  const size = Math.max(120, Math.min(zoneH, c.w * 0.92))
  const kami = data.kami[0]

  if (kami) {
    const cx = c.x + c.w / 2
    const kx = cx - size / 2
    const ky = top + (zoneH - size) / 2
    if (kami.golden) paintFoilBloom(ctx, cx, ky + size * 0.5, size * 0.62, p)
    paintContactShadow(ctx, cx, ky + size * 0.9, size * 0.82, p)
    ctx.save()
    /* nothing in this app is machine-square */
    ctx.translate(cx, ky + size / 2)
    ctx.rotate((stableTilt(`k-${data.seed}`, 1.6) * Math.PI) / 180)
    ctx.translate(-cx, -(ky + size / 2))
    paintKami(ctx, kami.art, kx, ky, size, p, {
      gold: kami.golden,
      hair: p.inkHair,
      hairWidth: spec.highInk ? 2.4 : 1.5,
    })
    ctx.restore()
  }

  let y = top + zoneH + m.rise + nameCap
  drawText(ctx, data.title, c.x + c.w / 2, y, nameFont, p.ink, 'center')
  y += binoLead
  drawText(ctx, data.subtitle, c.x + c.w / 2, y, binoFont, p.inkFaint, 'center')

  if (fact) {
    y += factGap + fact.size
    drawBlock(ctx, fact, factFont, c.x + c.w / 2, y, p.inkSoft, 'center')
  }
}

/* ── a planet: several Kami standing on a small round world ──────────────── */

function paintCrowd(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Box,
  spec: CardSpec,
): void {
  const headRule = paintHeader(ctx, data, m, p, c)
  const footRule = paintFooter(ctx, data, m, p, c, spec)

  const top = headRule + m.rise * 1.1
  const bottom = footRule - m.rise * 0.9

  const nameFont = fitLine(
    ctx,
    data.title,
    { family: 'display', size: m.nameSize, weight: 800, tracking: -0.02 },
    c.w,
    m.nameMin,
  )
  const subFont: FontSpec = { family: 'text', size: Math.round(m.binoSize * 0.92), weight: 600 }
  const factFont: FontSpec = { family: 'text', size: m.factSize, weight: 400 }

  const nameCap = nameFont.size * 0.74
  const subLead = Math.round(subFont.size * 1.7)
  const fact = data.fact ? fitBlock(ctx, data.fact, factFont, c.w, 2, m.factMin, 1.5) : null
  const factGap = Math.round(subFont.size * 1.05)

  const textH = nameCap + subLead + (fact ? factGap + fact.height : 0)
  const zoneH = bottom - top - textH - m.rise

  paintWorld(ctx, data, m, p, c, { x: c.x, y: top, w: c.w, h: zoneH })

  let y = top + zoneH + m.rise + nameCap
  drawText(ctx, data.title, c.x + c.w / 2, y, nameFont, p.ink, 'center')
  y += subLead
  drawText(ctx, data.subtitle, c.x + c.w / 2, y, subFont, p.inkSoft, 'center')
  if (fact) {
    y += factGap + fact.size
    drawBlock(ctx, fact, factFont, c.x + c.w / 2, y, p.inkFaint, 'center')
  }
}

/**
 * The planet itself: a disc of recessed paper with its own fold, and the
 * collection standing along the curve of it.
 */
function paintWorld(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Box,
  zone: Box,
): void {
  const cx = zone.x + zone.w / 2
  /* a shallow horizon: a big radius, only its cap showing above the fold */
  const rise = Math.min(zone.h * 0.42, zone.w * 0.3)
  const radius = (zone.w * zone.w) / (8 * rise) + rise / 2
  const cy = zone.y + zone.h - rise + radius

  const disc = new Path2D()
  disc.arc(cx, cy, radius, 0, Math.PI * 2)

  ctx.save()
  ctx.shadowColor = shadow(p, 0.16)
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 8
  ctx.fillStyle = p.paper2
  ctx.fill(disc)
  ctx.restore()

  ctx.save()
  ctx.clip(disc)
  /* the mountain fold running across the little world, at the icon's 34° */
  const slope = Math.tan((34 * Math.PI) / 180)
  const x0 = cx - radius
  const y0 = cy - radius * 0.06
  const x1 = cx + radius
  const y1 = y0 - (x1 - x0) * slope
  const under = new Path2D()
  under.moveTo(x0, y0)
  under.lineTo(x1, y1)
  under.lineTo(x1, cy + radius)
  under.lineTo(x0, cy + radius)
  under.closePath()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = p.paper3
  ctx.fill(under)
  ctx.globalAlpha = 1
  ctx.strokeStyle = hexA(p.paperEdge, 0.9)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  layGrain(ctx, p, { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 }, 1.1)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = p.paperEdge
  ctx.lineWidth = 1.6
  ctx.stroke(disc)
  ctx.restore()

  /* stand the collection along the curve, biggest in the middle */
  const list = data.kami
  if (list.length === 0) return
  const rand = mulberry32(hashSeed(data.seed))
  const spread = Math.min(1.02, 0.26 + list.length * 0.1)
  const base = Math.min(zone.h * 0.46, (zone.w / Math.max(3.1, list.length * 0.92)) * 1.5)

  list.forEach((k, i) => {
    const t = list.length === 1 ? 0 : (i / (list.length - 1)) * 2 - 1
    const angle = t * spread
    const px = cx + Math.sin(angle) * radius
    const py = cy - Math.cos(angle) * radius
    const size = base * (0.74 + (1 - Math.abs(t)) * 0.3) * (0.92 + rand() * 0.16)
    const tilt = angle * 0.42

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(tilt)
    if (k.golden) paintFoilBloom(ctx, 0, -size * 0.5, size * 0.66, p)
    paintContactShadow(ctx, 0, -size * 0.06, size * 0.78, p)
    paintKami(ctx, k.art, -size / 2, -size * 0.96, size, p, { gold: k.golden, hair: p.inkHair })
    ctx.restore()
  })

  /* how many did not fit on the card — said plainly, never as a badge */
  if (data.moreCount) {
    drawText(
      ctx,
      `and ${data.moreCount} more`,
      c.x + c.w,
      zone.y + zone.h,
      { family: 'text', size: Math.round(m.label * 1.02), weight: 600 },
      p.inkFaint,
      'right',
    )
  }
}

/** Everything a caller needs to size a canvas for one card. */
export function cardPixelSize(spec: CardSpec): { width: number; height: number } {
  const { w, h } = CARD_SIZE[spec.shape]
  return { width: Math.round(w * spec.pixelRatio), height: Math.round(h * spec.pixelRatio) }
}
