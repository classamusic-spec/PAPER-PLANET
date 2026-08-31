/* PAPER PLANET — the Bee. A kite folded small, pleated for stripes, wings drawn out. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN, hue } from '../palette'
import { CAM, PT, crossFold, kiteBase, mountain, press, pull, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const K = hue(TOKEN.kincha)

export const bee: SpeciesDef = {
  id: 'bee',
  name: 'Bee',
  binomial: 'Apis papyri',
  biome: 'meadow',
  rarity: 'uncommon',
  material: { front: K.base, back: TOKEN.paperBack },
  chirp: [1.5, 1.335, 1.5, 1.125],
  idle: 'flutter',
  reward: 26,
  unlock: { type: 'collection', count: 8 },
  meta: { tier: 'classic', surface: 'air', scale: 0.6, altitude: 0.3, flock: ['butterfly', 'ladybug'] },
  codex: CODEX.bee,
  art: [
    { pts: '86,72 32,40 28,80 88,98', fill: TOKEN.paper0, layer: 0 },
    { pts: '114,72 168,40 172,80 112,98', fill: TOKEN.paper2, layer: 0 },
    { pts: '76,66 124,66 132,110 116,150 84,150 68,110', fill: K.base, layer: 1 },
    { pts: '76,66 100,66 100,150 84,150 68,110', fill: K.light, layer: 1 },
    { pts: '71,90 129,90 132,106 69,106', fill: TOKEN.ink, layer: 1 },
    { pts: '76,120 124,120 119,136 81,136', fill: TOKEN.ink, layer: 1 },
    { pts: '94,150 100,168 106,150', fill: TOKEN.ink, layer: 1 },
    { circle: [100, 58, 20], fill: TOKEN.ink, layer: 1 },
    stroke(92, 42, 82, 22),
    stroke(108, 42, 118, 22),
    eye(91, 54, 4.2, TOKEN.kinchaSoft),
    eye(109, 54, 4.2, TOKEN.kinchaSoft),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'Small and neat. A bee is a very short fold with a lot in it.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        detail: 'The kite closes into a wedge. That wedge is the body.',
        camera: CAM.side,
      }),
      crossFold('stripes', PT.TL, PT.BR, 0.62, 0, PT.BR, 'mountain', 180, {
        instruction: 'Pleat the tail end — one fold under, one over.',
        detail: 'Each pleat shows a band of the reverse side. That is where the stripes come from.',
        effort: 3,
        camera: CAM.close,
      }),
      pull(
        'wings',
        [
          crease([300, 300], PT.RQ, [640, 300], 'valley', 120),
          crease([300, 300], PT.BQ, [300, 640], 'valley', 120),
        ],
        [560, 300],
        [640, 190],
        {
          instruction: 'Draw both wings up and forward.',
          detail: 'Wings sit ahead of the middle, not behind it. That is what makes it look like it is about to go.',
        },
      ),
      press('set', {
        instruction: 'Pinch the body, not the wings, and let it settle.',
        camera: CAM.desk,
      }),
    ],
  },
}
