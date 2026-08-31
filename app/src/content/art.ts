/* PAPER PLANET — small builders for creature art, so every eye is marked as an eye. */

import type { ArtPoly } from '../contracts'
import { TOKEN } from './palette'

/** A pupil. Always `eye: true`, so the Kami can blink. */
export function eye(cx: number, cy: number, r: number, fill: string = TOKEN.ink): ArtPoly {
  return { circle: [cx, cy, r], fill, noStroke: true, layer: 2, eye: true }
}

/** A cut-paper eye: a shape rather than a dot. Also blinks. */
export function eyeShape(pts: string, fill: string = TOKEN.ink): ArtPoly {
  return { pts, fill, noStroke: true, layer: 2, eye: true }
}

/** The white behind an eye. Not itself an eye — it does not blink. */
export function sclera(cx: number, cy: number, r: number, fill: string = TOKEN.paper0): ArtPoly {
  return { circle: [cx, cy, r], fill, layer: 1 }
}

/** A drawn line: whisker, mouth, antenna. */
export function stroke(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fill: string = TOKEN.ink,
): ArtPoly {
  return { line: [x1, y1, x2, y2], fill, noStroke: true, layer: 2 }
}
