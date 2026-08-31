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
import { fitKami, paintContactShadow, paintFoilBloom, paintKami, type Rect } from './kami'
import { measureLockup, paintLockup } from './logotype'
import { accentColor, cardPalette, mix, shadow, type CardPalette } from './palette'
import { layGrain } from './texture'
import { drawBlock, drawText, fitBlock, fitHeadline, type Block, type FontSpec } from './text'
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
  /** Where the fold meets the sheet's left edge, as a fraction of its height. */
  crease: number
}

const METRICS: Record<'square' | 'story', Metrics> = {
  square: {
    w: 1080, h: 1080, desk: 38, pad: 66,
    label: 21, nameSize: 82, nameMin: 52, binoSize: 29,
    factSize: 26, factMin: 21, factLines: 4,
    lockup: 33, minKami: 300, rise: 30, crease: 0.6,
  },
  story: {
    w: 1080, h: 1920, desk: 44, pad: 74,
    label: 24, nameSize: 110, nameMin: 62, binoSize: 38,
    factSize: 32, factMin: 26, factLines: 5,
    lockup: 41, minKami: 460, rise: 44, crease: 0.66,
  },
}

/** The angle of the fold that crosses everything in this brand. */
const CREASE_DEG = 34

/* ═══════════════════════════════════════════════════════════════════════════
   THE DESK AND THE SHEET
   ═══════════════════════════════════════════════════════════════════════════ */

function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** The desk the card lies on: paper's darkest value, lit from above-left. */
function paintDesk(ctx: CanvasRenderingContext2D, m: Metrics, p: CardPalette, night: boolean): void {
  ctx.fillStyle = p.paper4
  ctx.fillRect(0, 0, m.w, m.h)

  /* Night is not dark mode: it is a warm lamp pooling on a dark desk (§4.3). */
  const pool = ctx.createRadialGradient(m.w * 0.5, m.h * 0.4, 0, m.w * 0.5, m.h * 0.4, m.h * 0.8)
  if (night) {
    pool.addColorStop(0, hexA(p.kincha, 0.17))
    pool.addColorStop(0.55, hexA(p.kincha, 0.05))
    pool.addColorStop(1, hexA(p.kincha, 0))
  } else {
    pool.addColorStop(0, hexA(p.paper0, 0.22))
    pool.addColorStop(1, hexA(p.paper0, 0))
  }
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, m.w, m.h)

  layGrain(ctx, p, { x: 0, y: 0, w: m.w, h: m.h }, 0.85)
}

/** The boundary of the sheet: a mould-made deckle, generated from the seed. */
function sheetPath(box: Rect, seed: string): Path2D {
  const path = new Path2D()
  path.addPath(new Path2D(edgePath(box.w, box.h, seed, 'deckle', 22)), new DOMMatrix().translateSelf(box.x, box.y))
  return path
}

/**
 * One fold across the sheet at the icon's 34°.
 *
 * A fold in real paper is a narrow event: a band of shadow a few centimetres
 * wide on the far side of the crease, a catch-light on the near side, and flat
 * sheet again either way. Shading the whole half-page instead — which is what a
 * literal reading of the app icon gives you — makes the card look like two
 * pieces of card taped together.
 */
function paintCrease(ctx: CanvasRenderingContext2D, box: Rect, p: CardPalette, at: number): void {
  const slope = Math.tan((CREASE_DEG * Math.PI) / 180)
  const x0 = box.x - 60
  const x1 = box.x + box.w + 60
  const y0 = box.y + box.h * at
  const y1 = y0 - (x1 - x0) * slope

  /* a unit normal pointing down-right, away from the light */
  const len = Math.hypot(x1 - x0, y1 - y0)
  const nx = -(y1 - y0) / len
  const ny = (x1 - x0) / len
  const dark = Math.min(box.w, box.h) * 0.085
  const lit = dark * 0.5

  const band = (from: number, to: number): Path2D => {
    const path = new Path2D()
    path.moveTo(x0 + nx * from, y0 + ny * from)
    path.lineTo(x1 + nx * from, y1 + ny * from)
    path.lineTo(x1 + nx * to, y1 + ny * to)
    path.lineTo(x0 + nx * to, y0 + ny * to)
    path.closePath()
    return path
  }

  ctx.save()

  const down = ctx.createLinearGradient(x0, y0, x0 + nx * dark, y0 + ny * dark)
  down.addColorStop(0, mix(p.paper1, p.paper3, 0.5))
  down.addColorStop(0.28, mix(p.paper1, p.paper2, 0.6))
  down.addColorStop(1, p.paper1)
  ctx.fillStyle = down
  ctx.fill(band(0, dark))

  const up = ctx.createLinearGradient(x0, y0, x0 - nx * lit, y0 - ny * lit)
  up.addColorStop(0, hexA(p.paper0, 0.62))
  up.addColorStop(1, hexA(p.paper0, 0))
  ctx.fillStyle = up
  ctx.fill(band(0, -lit))

  /* the crease itself — one hair, barely there */
  ctx.lineWidth = 1
  ctx.strokeStyle = hexA(p.paperEdge, 0.55)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.restore()
}

/** Lay the sheet down: shadow, paper, fibre, fold, rim. */
function paintSheet(ctx: CanvasRenderingContext2D, box: Rect, p: CardPalette, seed: string, creaseAt: number): Path2D {
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

function rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, p: CardPalette): void {
  ctx.save()
  ctx.strokeStyle = p.inkHair
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

  ctx.save()
  ctx.scale(spec.pixelRatio, spec.pixelRatio)
  ctx.clearRect(0, 0, m.w, m.h)

  paintDesk(ctx, m, p, spec.theme === 'night')

  const sheet: Rect = { x: m.desk, y: m.desk, w: m.w - m.desk * 2, h: m.h - m.desk * 2 }
  const path = paintSheet(ctx, sheet, p, data.seed, data.layout === 'crowd' ? m.crease - 0.22 : m.crease)

  ctx.save()
  ctx.clip(path)
  const content: Rect = {
    x: sheet.x + m.pad,
    y: sheet.y + m.pad,
    w: sheet.w - m.pad * 2,
    h: sheet.h - m.pad * 2,
  }
  if (data.layout === 'crowd') paintCrowd(ctx, data, m, p, content, sheet, spec)
  else paintSpecimen(ctx, data, m, p, content, spec)
  ctx.restore()

  ctx.restore()
}

const LABEL = (size: number): FontSpec => ({ family: 'text', size, weight: 800, tracking: 0.14 })

/** The two tracked labels along the top, and the rule beneath them. */
function paintHeader(ctx: CanvasRenderingContext2D, data: CardData, m: Metrics, p: CardPalette, c: Rect): number {
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

interface Footer {
  /** Baseline of the hairline above the maker's line. */
  ruleY: number
  top: number
  height: number
  lock: { width: number; height: number }
  font: FontSpec
  lead: number
  tagline: boolean
}

/**
 * Measure the maker's line without drawing it. The world on a planet card is
 * painted across the whole sheet, so the footer has to know where it goes
 * before anything covers the place it goes.
 */
function measureFooter(ctx: CanvasRenderingContext2D, data: CardData, m: Metrics, c: Rect, spec: CardSpec): Footer {
  const tagline = spec.shape === 'story'
  const lock = measureLockup(ctx, { size: m.lockup, tagline, mark: true })
  const font: FontSpec = { family: 'text', size: Math.round(m.label * 1.02), weight: 600 }
  const lead = Math.round(font.size * 1.42)
  const height = Math.max(lock.height, data.provenance.length * lead)
  const top = c.y + c.h - height
  return { ruleY: top - m.label * 1.6, top, height, lock, font, lead, tagline }
}

/** The maker's line: what it was folded from, and the mark that signs it. */
function paintFooter(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Rect,
  f: Footer,
): void {
  paintLockup(ctx, c.x + c.w - f.lock.width, f.top + (f.height - f.lock.height) / 2, p, {
    size: m.lockup,
    tagline: f.tagline,
    mark: true,
  })

  const provH = data.provenance.length * f.lead
  let y = f.top + (f.height - provH) / 2 + f.font.size
  for (const line of data.provenance) {
    drawText(ctx, line, c.x, y, f.font, p.inkFaint)
    y += f.lead
  }

  rule(ctx, c.x, f.ruleY, c.w, p)
}

/**
 * The prose. Centred while it is a line or two — any longer and it is set as a
 * block, because BRAND §5 does not centre a paragraph and a centred four-liner
 * is exactly the ragged shape it is warning about.
 */
function paintProse(
  ctx: CanvasRenderingContext2D,
  block: Block,
  font: FontSpec,
  c: Rect,
  firstBaseline: number,
  fill: string,
): void {
  if (block.lines.length <= 2) {
    drawBlock(ctx, block, font, c.x + c.w / 2, firstBaseline, fill, 'center')
    return
  }
  drawBlock(ctx, block, font, c.x + (c.w - block.width) / 2, firstBaseline, fill, 'left')
}

/* ── one Kami, on its own ────────────────────────────────────────────────── */

function paintSpecimen(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Rect,
  spec: CardSpec,
): void {
  const headRule = paintHeader(ctx, data, m, p, c)
  const footer = measureFooter(ctx, data, m, c, spec)
  paintFooter(ctx, data, m, p, c, footer)

  const top = headRule + m.rise * 0.95
  const bottom = footer.ruleY - m.rise * 0.7

  /* set the type first — the creature takes what is left */
  const nameFont: FontSpec = { family: 'display', size: m.nameSize, weight: 800, tracking: -0.02 }
  const head = fitHeadline(ctx, data.title, nameFont, c.w, m.nameMin, 2)
  const binoFont: FontSpec = { family: 'display', size: m.binoSize, weight: 400, italic: true }
  const factFont: FontSpec = { family: 'text', size: m.factSize, weight: 400 }
  const measureWidth = Math.round(c.w * 0.94)

  const nameCap = head.height
  const binoLead = Math.round(binoFont.size * 1.52)
  const factGap = Math.round(binoFont.size * 1.02)

  let fact: Block | null = data.fact
    ? fitBlock(ctx, data.fact, factFont, measureWidth, m.factLines, m.factMin, 1.46)
    : null

  const textH = (f: Block | null): number => nameCap + binoLead + (f ? factGap + f.height : 0)
  /* the codex fact rides along only if the creature still has room to be seen */
  if (fact && bottom - top - textH(fact) - m.rise < m.minKami) {
    const tighter = data.fact
      ? fitBlock(ctx, data.fact, factFont, measureWidth, Math.max(2, m.factLines - 1), m.factMin, 1.4)
      : null
    fact = tighter && bottom - top - textH(tighter) - m.rise >= m.minKami ? tighter : null
  }

  const zoneH = bottom - top - textH(fact) - m.rise
  const kami = data.kami[0]

  if (kami) {
    const box: Rect = {
      x: c.x + c.w * 0.03,
      y: top,
      w: c.w * 0.94,
      /* leave the creature its own shadow's worth of ground to stand on */
      h: Math.max(120, zoneH - zoneH * 0.06),
    }
    const cx = c.x + c.w / 2
    const cy = top + zoneH / 2

    ctx.save()
    /* nothing in this app is machine-square */
    ctx.translate(cx, cy)
    ctx.rotate((stableTilt(`k-${data.seed}`, 1.5) * Math.PI) / 180)
    ctx.translate(-cx, -cy)

    const ink = fitKami(kami.art, box)
    if (kami.golden) paintFoilBloom(ctx, cx, box.y + box.h / 2, Math.max(ink.w, ink.h) * 0.72, p)
    paintContactShadow(ctx, cx, ink.y + ink.h + ink.h * 0.028, ink.w * 0.78, p)
    paintKami(ctx, kami.art, box, p, {
      gold: kami.golden,
      hair: p.inkHair,
      hairWidth: spec.highInk ? 3.6 : 2.4,
    })
    ctx.restore()
  }

  let y = top + zoneH + m.rise + head.size * 0.74
  y = drawBlock(ctx, head, nameFont, c.x + c.w / 2, y, p.ink, 'center')
  y += binoLead
  drawText(ctx, data.subtitle, c.x + c.w / 2, y, binoFont, p.inkFaint, 'center')

  if (fact) {
    y += factGap + fact.size
    paintProse(ctx, fact, factFont, c, y, p.inkSoft)
  }
}

/* ── a planet: several Kami standing on a small round world ──────────────── */

function paintCrowd(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  m: Metrics,
  p: CardPalette,
  c: Rect,
  sheet: Rect,
  spec: CardSpec,
): void {
  /* nothing is painted until the world is: its ground runs the width of the
     sheet and would bury anything already on the paper */
  const footer = measureFooter(ctx, data, m, c, spec)
  const headRule = c.y + m.label + m.label * 0.95

  const top = headRule + m.rise * 1.05
  const bottom = footer.ruleY - m.rise * 0.85

  const nameFont: FontSpec = { family: 'display', size: Math.round(m.nameSize * 0.86), weight: 800, tracking: -0.02 }
  const head = fitHeadline(ctx, data.title, nameFont, c.w, m.nameMin, 2)
  const subFont: FontSpec = { family: 'text', size: Math.round(m.binoSize * 0.94), weight: 600 }
  const factFont: FontSpec = { family: 'text', size: m.factSize, weight: 400 }
  const measureWidth = Math.round(c.w * 0.94)

  const nameCap = head.height
  const subLead = Math.round(subFont.size * 1.7)
  const fact = data.fact ? fitBlock(ctx, data.fact, factFont, measureWidth, 2, m.factMin, 1.5) : null
  const factGap = Math.round(subFont.size * 1.05)

  /* A world only needs so much sky. Cap the zone and share the surplus above
     and below the group, so a tall story card is composed rather than stretched. */
  const textH = nameCap + subLead + (fact ? factGap + fact.height : 0)
  const avail = bottom - top
  const zoneH = Math.min(avail - textH - m.rise, c.w * 0.92)
  const y0 = top + Math.max(0, avail - (zoneH + m.rise + textH)) * 0.56

  paintWorld(ctx, data, p, { x: c.x, y: y0, w: c.w, h: zoneH }, sheet)
  paintHeader(ctx, data, m, p, c)
  paintFooter(ctx, data, m, p, c, footer)

  let y = y0 + zoneH + m.rise + head.size * 0.74
  y = drawBlock(ctx, head, nameFont, c.x + c.w / 2, y, p.ink, 'center')
  y += subLead
  drawText(ctx, data.subtitle, c.x + c.w / 2, y, subFont, p.inkSoft, 'center')
  if (fact) {
    y += factGap + fact.size
    paintProse(ctx, fact, factFont, c, y, p.inkSoft)
  }
}

/**
 * The world: a curved horizon running the full width of the sheet, with the
 * collection standing along it.
 *
 * The first attempt drew a whole disc, which spilled off the paper and buried
 * the type under half a planet. A horizon says the same thing — this is a small
 * round world and these live on it — and leaves the sheet a sheet.
 */
function paintWorld(ctx: CanvasRenderingContext2D, data: CardData, p: CardPalette, zone: Rect, sheet: Rect): void {
  const list = data.kami
  const cx = sheet.x + sheet.w / 2
  const rise = zone.h * 0.4
  const radius = (sheet.w * sheet.w) / (8 * rise) + rise / 2
  const cy = zone.y + zone.h - rise + radius
  const floor = sheet.y + sheet.h + 80

  const ground = new Path2D()
  ground.arc(cx, cy, radius, Math.PI, Math.PI * 2)
  ground.lineTo(cx + radius, floor)
  ground.lineTo(cx - radius, floor)
  ground.closePath()

  ctx.save()
  ctx.fillStyle = mix(p.paper1, p.paper2, 0.62)
  ctx.fill(ground)
  layGrain(ctx, p, { x: sheet.x, y: zone.y, w: sheet.w, h: floor - zone.y }, 0.5)
  ctx.restore()

  /* the horizon itself: the cut edge of the world */
  ctx.save()
  ctx.strokeStyle = p.paperEdge
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  if (list.length === 0) return

  /* stand the collection along the curve, biggest in the middle */
  const rand = mulberry32(hashSeed(data.seed))
  const half = zone.w / 2
  const spread = Math.asin(Math.min(0.86, (half * 0.84) / radius))
  const step = list.length > 1 ? (2 * spread * radius) / (list.length - 1) : zone.w * 0.4
  const base = Math.min(step * 1.32, zone.h - rise - 10, zone.w * 0.34)

  list.forEach((k, i) => {
    const t = list.length === 1 ? 0 : (i / (list.length - 1)) * 2 - 1
    const angle = t * spread
    const px = cx + Math.sin(angle) * radius
    const py = cy - Math.cos(angle) * radius
    const size = base * (0.82 + (1 - Math.abs(t)) * 0.24) * (0.94 + rand() * 0.12)

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(angle)
    const box: Rect = { x: -size / 2, y: -size, w: size, h: size }
    const ink = fitKami(k.art, box)
    if (k.golden) paintFoilBloom(ctx, 0, -size * 0.52, size * 0.5, p)
    paintContactShadow(ctx, 0, ink.y + ink.h + size * 0.015, ink.w * 0.78, p)
    paintKami(ctx, k.art, box, p, { gold: k.golden, hair: p.inkHair, hairWidth: 2 })
    ctx.restore()
  })
}

/** Everything a caller needs to size a canvas for one card. */
export function cardPixelSize(spec: CardSpec): { width: number; height: number } {
  const { w, h } = CARD_SIZE[spec.shape]
  return { width: Math.round(w * spec.pixelRatio), height: Math.round(h * spec.pixelRatio) }
}
