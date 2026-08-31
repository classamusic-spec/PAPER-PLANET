/*
 * PAPER PLANET — Share Card typesetting.
 *
 * Two families doing separate jobs (BRAND §5): Fraunces for the display line and
 * the binomial, Nunito for prose and for the tiny tracked labels. Canvas takes a
 * CSS font shorthand, so the only real work here is (a) making sure the faces
 * are decoded before the first `fillText`, or the card is set in Georgia, and
 * (b) fitting and wrapping, because a keepsake may not clip a word.
 */

export type Family = 'display' | 'text'

const STACK: Record<Family, string> = {
  display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
  text: "'Nunito', ui-rounded, -apple-system, system-ui, sans-serif",
}

export interface FontSpec {
  family: Family
  size: number
  weight?: number
  italic?: boolean
  /** em tracking, e.g. `-0.02` for display, `0.14` for a label. */
  tracking?: number
}

export function fontString(f: FontSpec): string {
  const style = f.italic ? 'italic ' : ''
  return `${style}${f.weight ?? 400} ${f.size}px ${STACK[f.family]}`
}

/* ── loading ─────────────────────────────────────────────────────────────── */

/** Every face the card can ask for. Loaded once, before anything is painted. */
const FACES = [
  '900 100px Fraunces',
  '800 100px Fraunces',
  '700 100px Fraunces',
  '600 100px Fraunces',
  'italic 400 100px Fraunces',
  '400 100px Nunito',
  '600 100px Nunito',
  '700 100px Nunito',
  '800 100px Nunito',
]

let pending: Promise<void> | null = null

/**
 * Resolve once every face the card uses is decodable. `document.fonts.load`
 * alone is not enough on a cold start — the descriptor may not be registered
 * yet — so we wait for `ready` as well. Never rejects: a card set in the
 * fallback face is worse than a card, but it is still a card.
 */
export function fontsReady(): Promise<void> {
  if (pending) return pending
  pending = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return
    try {
      await document.fonts.ready
      await Promise.all(FACES.map((f) => document.fonts.load(f, 'Paper Planet 0123456789')))
      await document.fonts.ready
    } catch {
      /* a browser that cannot tell us is a browser we draw for anyway */
    }
  })()
  return pending
}

/* ── measuring and drawing ───────────────────────────────────────────────── */

/** True when the engine can space letters for us and keep the kerning pairs. */
const CAN_TRACK = (): boolean =>
  typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype

interface Tracked {
  ctx: CanvasRenderingContext2D
  spacing: number
}

function applyFont(ctx: CanvasRenderingContext2D, f: FontSpec): Tracked {
  ctx.font = fontString(f)
  const spacing = (f.tracking ?? 0) * f.size
  if (CAN_TRACK()) {
    ctx.letterSpacing = `${spacing}px`
    return { ctx, spacing: 0 }
  }
  ctx.letterSpacing = ''
  return { ctx, spacing }
}

function clearFont(ctx: CanvasRenderingContext2D): void {
  if (CAN_TRACK()) ctx.letterSpacing = '0px'
}

export function measure(ctx: CanvasRenderingContext2D, text: string, f: FontSpec): number {
  const { spacing } = applyFont(ctx, f)
  let w = ctx.measureText(text).width
  if (spacing !== 0) w += spacing * Math.max(0, text.length - 1)
  clearFont(ctx)
  return w
}

export type Align = 'left' | 'right' | 'center'

/** Anything canvas will fill with. Display type sometimes wants a gradient. */
export type Paint = string | CanvasGradient | CanvasPattern

/**
 * Draw one line. `x` is the left, right or centre depending on `align`; `y` is
 * the alphabetic baseline, because a card is set to a baseline grid, not to a
 * box. Returns the drawn width.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  f: FontSpec,
  fill: Paint,
  align: Align = 'left',
): number {
  const { spacing } = applyFont(ctx, f)
  let width = ctx.measureText(text).width
  if (spacing !== 0) width += spacing * Math.max(0, text.length - 1)

  const left = align === 'left' ? x : align === 'right' ? x - width : x - width / 2
  ctx.save()
  ctx.fillStyle = fill
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (spacing === 0) {
    ctx.fillText(text, left, y)
  } else {
    /* no engine tracking: advance by hand. Labels only, where kerning is moot. */
    let pen = left
    for (const ch of text) {
      ctx.fillText(ch, pen, y)
      pen += ctx.measureText(ch).width + spacing
    }
  }
  ctx.restore()
  clearFont(ctx)
  return width
}

/** Wrap on spaces. Words longer than the measure are left long rather than cut. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, f: FontSpec, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`
    if (measure(ctx, next, f) <= maxWidth) line = next
    else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

export interface Block {
  lines: string[]
  size: number
  leading: number
  height: number
  /** The measure the lines were actually set to, after balancing. */
  width: number
}

/**
 * Narrow the measure until the line count is about to change. Setting a
 * paragraph to the widest measure that fits leaves orphans — a last line
 * holding one word — and a card is too small a thing to carry one.
 */
function balance(
  ctx: CanvasRenderingContext2D,
  text: string,
  f: FontSpec,
  maxWidth: number,
  lines: string[],
): { lines: string[]; width: number } {
  if (lines.length < 2) return { lines, width: maxWidth }
  let best = lines
  let width = maxWidth
  for (let k = 0.97; k >= 0.68; k -= 0.03) {
    const w = maxWidth * k
    const tryLines = wrap(ctx, text, f, w)
    if (tryLines.length !== lines.length) break
    best = tryLines
    width = w
  }
  return { lines: best, width }
}

/**
 * Set a paragraph so it fits `maxWidth × maxLines`, stepping the size down
 * before giving up. Returns `null` when even the smallest step overflows —
 * the card then simply does not carry that block, which is the honest answer
 * to "the codex fact if it fits".
 */
export function fitBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  f: FontSpec,
  maxWidth: number,
  maxLines: number,
  minSize: number,
  leadingRatio = 1.5,
): Block | null {
  for (let size = f.size; size >= minSize; size -= 1) {
    const at: FontSpec = { ...f, size }
    const lines = wrap(ctx, text, at, maxWidth)
    if (lines.length <= maxLines) {
      const even = balance(ctx, text, at, maxWidth, lines)
      const leading = Math.round(size * leadingRatio)
      return {
        lines: even.lines,
        size,
        leading,
        height: leading * even.lines.length,
        width: even.width,
      }
    }
  }
  return null
}

/**
 * Set a display line so it cannot overhang, whatever it says.
 *
 * A species name is at most fifteen characters, but a player names their own
 * Kami and will name one "Mochi the Extraordinarily Long-Named Flying
 * Squirrel". So: shrink to fit on one line; failing that wrap to two; failing
 * that cut at a word and mark the cut. The card is never allowed to clip.
 */
export function fitHeadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  f: FontSpec,
  maxWidth: number,
  minSize: number,
  maxLines = 2,
): Block {
  const made = (lines: string[], size: number): Block => {
    const leading = Math.round(size * 1.06)
    return { lines, size, leading, height: size * 0.74 + (lines.length - 1) * leading, width: maxWidth }
  }

  for (let size = f.size; size >= minSize; size -= 1) {
    if (measure(ctx, text, { ...f, size }) <= maxWidth) return made([text], size)
  }
  for (let size = Math.round(f.size * 0.8); size >= minSize; size -= 1) {
    const lines = wrap(ctx, text, { ...f, size }, maxWidth)
    if (lines.length <= maxLines) return made(lines, size)
  }

  const size = minSize
  const at: FontSpec = { ...f, size }
  const lines = wrap(ctx, text, at, maxWidth).slice(0, maxLines)
  const last = lines.length - 1
  let tail = lines[last]
  while (tail.length > 1 && measure(ctx, `${tail}…`, at) > maxWidth) tail = tail.slice(0, -1).trimEnd()
  lines[last] = `${tail}…`
  return made(lines, size)
}

/** Draw a set block from its first baseline. Returns the baseline after the last line. */
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  f: FontSpec,
  x: number,
  firstBaseline: number,
  fill: Paint,
  align: Align = 'left',
): number {
  let y = firstBaseline
  for (const line of block.lines) {
    drawText(ctx, line, x, y, { ...f, size: block.size }, fill, align)
    y += block.leading
  }
  return y - block.leading
}
