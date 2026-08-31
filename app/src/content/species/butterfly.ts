/* PAPER PLANET — the Butterfly. Two diagonals and a pinch: the first fold anyone makes. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN, hue } from '../palette'
import { PT, burnish, crease, pinch, simpleBase } from '../recipes'
import type { SpeciesDef } from '../types'

const M = hue(TOKEN.murasaki)
const B = hue(TOKEN.beni)

export const butterfly: SpeciesDef = {
  id: 'butterfly',
  name: 'Butterfly',
  binomial: 'Papilio primus',
  biome: 'meadow',
  rarity: 'common',
  material: { front: M.base, back: TOKEN.paperBack },
  chirp: [1, 1.5, 2],
  idle: 'flutter',
  reward: 12,
  unlock: { type: 'free' },
  meta: { tier: 'simple', surface: 'air', scale: 0.72, altitude: 0.42, flock: ['moth', 'bee'] },
  codex: CODEX.butterfly,
  art: [
    { pts: '96,58 36,26 26,78 96,102', fill: M.light, layer: 0 },
    { pts: '104,58 164,26 174,78 104,102', fill: M.base, layer: 0 },
    { pts: '96,104 34,88 52,146 96,138', fill: B.base, layer: 0 },
    { pts: '104,104 166,88 148,146 104,138', fill: B.dark, layer: 0 },
    { circle: [56, 60, 8], fill: TOKEN.kincha, noStroke: true, layer: 1 },
    { circle: [144, 60, 8], fill: TOKEN.kincha, noStroke: true, layer: 1 },
    { circle: [58, 112, 6], fill: TOKEN.paper0, noStroke: true, layer: 1 },
    { circle: [142, 112, 6], fill: TOKEN.paper0, noStroke: true, layer: 1 },
    { pts: '95,52 105,52 104,150 96,150', fill: TOKEN.ink, layer: 1 },
    { circle: [100, 44, 9], fill: TOKEN.ink, layer: 1 },
    stroke(96, 38, 84, 20, TOKEN.ink),
    stroke(104, 38, 116, 20, TOKEN.ink),
    eye(96.5, 42, 2.3, TOKEN.kinchaSoft),
    eye(103.5, 42, 2.3, TOKEN.kinchaSoft),
  ],
  recipe: {
    base: 'none',
    steps: [
      ...simpleBase({ detail: 'Corner onto corner. Take your time lining them up — everything after this is easy.' }),
      burnish('mark', [[PT.TR, PT.BL, PT.TL]], 'valley', {
        instruction: 'Rub a line down the middle of the triangle.',
        detail: 'Do not fold it. You only want to know where the middle is.',
      }),
      pinch('wings', [crease(PT.TR, PT.BL, PT.TL, 'valley', 148)], PT.TL, PT.C, {
        instruction: 'Pinch the middle and let the wings lift.',
        detail: 'Not flat. Wings sit open, at about the angle of a book you are reading.',
        effort: 2,
      }),
    ],
  },
}
