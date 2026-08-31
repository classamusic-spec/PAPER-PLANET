/*
 * PAPER PLANET — Share Card fibre.
 *
 * The app draws its paper with two stacked SVG turbulence fields: `--grain-fine`
 * (fractal noise, isotropic, the tooth of the sheet) and `--grain-fibre`
 * (turbulence stretched 5:1 along x, the pulp itself). A canvas cannot use an
 * SVG filter without a network-free image round-trip, so both fields are built
 * here as tiles and repeated — same two layers, same frequencies, same tint.
 *
 * Tiles are cached per theme: a preview redraws on every keystroke of the
 * controls, and regenerating 250k pixels each time would be felt.
 */

import { mulberry32 } from '../../ui/paperShapes'
import type { CardPalette } from './palette'

const FINE_TILE = 180
const FIBRE_TILE = 360

/**
 * How many card pixels one cell of the tooth covers.
 *
 * The app's grain is authored in CSS pixels and seen at 2–3× device pixels, so
 * one noise cell per *card* pixel is finer than the app has ever been — and
 * white noise is incompressible, which turned a card into a seven-megabyte PNG
 * nobody wants to send. Cells are written as flat blocks (never interpolated,
 * which would put the entropy straight back), so the field is both truer to the
 * app and something the encoder can actually pack.
 */
const FINE_SCALE = 2

/**
 * Both fields are laid on a 360-unit tile, so a 1080-wide card carries exactly
 * three repeats across every scanline — which is inside zlib's window, and is
 * the difference between a card you can send and a card you cannot.
 */

/**
 * Alpha in sixteen steps rather than 256. The eye cannot see the difference in
 * an 8%-opacity field; PNG very much can.
 */
function quantise(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 15) * 17
}

/** The same, in eight steps, for the smooth field where banding cannot show. */
function quantise8(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 7) * 36
}

/** Value noise on a wrapping lattice, so the tile repeats without a seam. */
function lattice(rand: () => number, nx: number, ny: number): Float32Array {
  const grid = new Float32Array(nx * ny)
  for (let i = 0; i < grid.length; i++) grid[i] = rand()
  return grid
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function sample(grid: Float32Array, nx: number, ny: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const i0 = ((x0 % nx) + nx) % nx
  const j0 = ((y0 % ny) + ny) % ny
  const i1 = (i0 + 1) % nx
  const j1 = (j0 + 1) % ny
  const a = grid[j0 * nx + i0]
  const b = grid[j0 * nx + i1]
  const c = grid[j1 * nx + i0]
  const d = grid[j1 * nx + i1]
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

function makeCanvas(size: number): HTMLCanvasElement {
  const el = document.createElement('canvas')
  el.width = size
  el.height = size
  return el
}

/**
 * The tooth: isotropic fractal noise, three octaves, mapped straight to alpha.
 * `feTurbulence baseFrequency="0.9"` is essentially per-pixel, so the first
 * octave has a one-pixel lattice.
 */
function fineTile(rgb: string): HTMLCanvasElement {
  const size = FINE_TILE * FINE_SCALE
  const el = makeCanvas(size)
  const ctx = el.getContext('2d')
  if (!ctx) return el
  const img = ctx.createImageData(size, size)
  const rand = mulberry32(0x9e3779b9)
  const [r, g, b] = rgb.split(',').map((v) => Number(v.trim()))
  const cells = new Uint8ClampedArray(FINE_TILE * FINE_TILE)
  for (let i = 0; i < cells.length; i++) cells[i] = quantise(rand() * 0.72 + rand() * 0.28)
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / FINE_SCALE) * FINE_TILE
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = cells[row + Math.floor(x / FINE_SCALE)]
    }
  }
  ctx.putImageData(img, 0, 0)
  return el
}

/**
 * The pulp: noise with a long wavelength across the sheet and a short one down
 * it, which is what `baseFrequency="0.026 0.13"` means — fibres lying flat.
 */
function fibreTile(rgb: string): HTMLCanvasElement {
  const el = makeCanvas(FIBRE_TILE)
  const ctx = el.getContext('2d')
  if (!ctx) return el
  const img = ctx.createImageData(FIBRE_TILE, FIBRE_TILE)
  const [r, g, b] = rgb.split(',').map((v) => Number(v.trim()))

  /* Two octaves on wrapping lattices that divide the tile exactly. The bass
     octave is deliberately weak — giving it its natural weight turns paper into
     marbled leather — and the treble stops at a four-pixel wavelength, because
     below that the field stops reading as fibre and starts being white noise,
     which is invisible to the eye and enormous to the encoder. */
  const octaves = [
    { nx: 12, ny: 45, amp: 0.56 },
    { nx: 24, ny: 90, amp: 0.44 },
  ]
  const grids = octaves.map((o, i) => lattice(mulberry32(0x1a2b3c ^ (i * 977)), o.nx, o.ny))

  for (let y = 0; y < FIBRE_TILE; y++) {
    for (let x = 0; x < FIBRE_TILE; x++) {
      let v = 0
      for (let o = 0; o < octaves.length; o++) {
        const { nx, ny, amp } = octaves[o]
        v += sample(grids[o], nx, ny, (x / FIBRE_TILE) * nx, (y / FIBRE_TILE) * ny) * amp
      }
      /* a gentle S, so the fibres read without the sheet looking stained */
      const a = Math.max(0, Math.min(1, (v - 0.5) * 1.25 + 0.5))
      const i = (y * FIBRE_TILE + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = quantise8(a)
    }
  }
  ctx.putImageData(img, 0, 0)
  return el
}

interface Grain {
  fine: CanvasPattern | null
  fibre: CanvasPattern | null
}

const CACHE = new Map<string, { fine: HTMLCanvasElement; fibre: HTMLCanvasElement }>()

function tiles(rgb: string): { fine: HTMLCanvasElement; fibre: HTMLCanvasElement } {
  const hit = CACHE.get(rgb)
  if (hit) return hit
  const built = { fine: fineTile(rgb), fibre: fibreTile(rgb) }
  CACHE.set(rgb, built)
  return built
}

export function grainPatterns(ctx: CanvasRenderingContext2D, p: CardPalette): Grain {
  const { fine, fibre } = tiles(p.grainInk)
  return { fine: ctx.createPattern(fine, 'repeat'), fibre: ctx.createPattern(fibre, 'repeat') }
}

/**
 * Lay both fields over whatever is already clipped in. `strength` scales the
 * theme's own grain alpha, so a recessed tile can be grainier than the sheet.
 */
export function layGrain(
  ctx: CanvasRenderingContext2D,
  p: CardPalette,
  box: { x: number; y: number; w: number; h: number },
  strength = 1,
): void {
  const g = grainPatterns(ctx, p)
  ctx.save()
  ctx.globalAlpha = p.grainAlpha * strength
  if (g.fine) {
    ctx.fillStyle = g.fine
    ctx.fillRect(box.x, box.y, box.w, box.h)
  }
  if (g.fibre) {
    ctx.globalAlpha = p.grainAlpha * strength * 0.72
    ctx.fillStyle = g.fibre
    ctx.fillRect(box.x, box.y, box.w, box.h)
  }
  ctx.restore()
}
