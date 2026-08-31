/* PAPER PLANET — the two ways a card leaves the composer: onto the screen, or into a file. */

import { cardPixelSize, paintCard } from './card'
import { canvasToBlob } from './export'
import { fontsReady } from './text'
import type { CardData, CardSpec } from './types'

/**
 * Paint into an existing canvas, sizing its backing store to the spec. The
 * caller decides `pixelRatio`: a preview asks for just enough pixels to look
 * sharp where it sits, an export always asks for 2×.
 */
export async function renderCard(canvas: HTMLCanvasElement, data: CardData, spec: CardSpec): Promise<boolean> {
  await fontsReady()
  const { width, height } = cardPixelSize(spec)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.clearRect(0, 0, width, height)
  paintCard(ctx, data, spec)
  return true
}

/** Compose the real thing, off-screen, at full resolution. */
export async function renderCardBlob(data: CardData, spec: CardSpec): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  const ok = await renderCard(canvas, data, spec)
  if (!ok) return null
  return canvasToBlob(canvas)
}
