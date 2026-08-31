/* PAPER PLANET — the Orizuru. The true crane, from the bird base. The oldest published fold there is. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, birdBase, flip, mountain, pinch, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const B = hue(mix(TOKEN.beni, TOKEN.goldLeaf, 0.18))

export const orizuru: SpeciesDef = {
  id: 'orizuru',
  name: 'Orizuru',
  binomial: 'Grus mille',
  biome: 'peak',
  rarity: 'mythic',
  material: { front: B.base, back: TOKEN.paperBack, foil: 0.35 },
  chirp: [1, 1.5, 2, 2.5, 3],
  idle: 'fly',
  reward: 80,
  unlock: { type: 'species', id: 'crane', mastery: 'grand' },
  meta: { tier: 'grand', surface: 'air', scale: 1.24, altitude: 0.5, flock: ['crane'] },
  codex: CODEX.orizuru,
  art: [
    { pts: '100,88 22,50 28,96 96,110', fill: B.light, layer: 0 },
    { pts: '100,88 178,50 172,96 104,110', fill: B.dark, layer: 0 },
    { pts: '100,86 130,120 100,152 70,120', fill: B.base, layer: 1 },
    { pts: '100,86 100,152 70,120', fill: B.light, layer: 1 },
    { pts: '96,92 50,32 42,40 92,104', fill: B.base, layer: 1 },
    { pts: '50,32 32,28 48,44', fill: B.dark, layer: 1 },
    { pts: '104,92 152,34 160,42 110,102', fill: B.dark, layer: 1 },
    { pts: '30,26 14,30 30,36', fill: TOKEN.kincha, layer: 2 },
    { pts: '94,120 106,120 100,134', fill: TOKEN.goldHi, noStroke: true, layer: 2 },
    eye(42, 34, 3.2),
  ],
  recipe: {
    base: 'bird',
    steps: [
      ...birdBase({ detail: 'Four points. Every crane that has ever been folded came from this shape.' }),
      pinch(
        'narrow-front',
        [
          crease(PT.C, PT.RIDGE_TL_A, [520, 240], 'valley', 180),
          crease(PT.C, PT.RIDGE_TL_B, [240, 520], 'valley', 180),
        ],
        [420, 340],
        PT.C,
        {
          instruction: 'Bring the two lower edges of the near flap in to the middle.',
          detail: 'This is what makes a crane narrow instead of fat. Everything after depends on it.',
          camera: CAM.close,
        },
      ),
      flip('turn', {
        instruction: 'Turn it over.',
      }),
      pinch(
        'narrow-back',
        [
          crease(PT.C, PT.RIDGE_BR_A, [480, 760], 'valley', 180),
          crease(PT.C, PT.RIDGE_BR_B, [760, 480], 'valley', 180),
        ],
        [580, 660],
        PT.C,
        {
          instruction: 'And the same two edges on this side.',
          detail: 'Match the front exactly. Hold it up to a lamp if you are not sure.',
        },
      ),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Close it along the middle, away from you.',
        camera: CAM.side,
      }),
      reverseAt('neck', PT.TL, PT.BR, 0.42, -20, PT.TL, 'mountain', {
        instruction: 'Reverse one point up for the neck.',
        detail: 'Decide the angle now. A crane looks up, or ahead, or down, and it is this crease that chooses.',
        camera: CAM.close,
      }),
      reverseAt('tail', PT.TL, PT.BR, 0.58, 20, PT.BR, 'mountain', {
        instruction: 'And the other point up, for the tail.',
        detail: 'The same angle, mirrored. Cranes are built symmetrically and then they lean.',
      }),
      reverseAt('head', PT.TL, PT.BR, 0.18, 40, PT.TL, 'valley', {
        instruction: 'A small reverse at the tip for the head.',
        detail: 'One centimetre of paper. It is the last fold that matters and the easiest to rush.',
        camera: CAM.detail,
      }),
      pull('wing-near', [crease([340, 380], PT.RQ, [700, 380], 'valley', 130)], [620, 400], [700, 220], {
        instruction: 'Draw the near wing down and out.',
        detail: 'Down, not up. The wings hang below the body, which is why a folded crane balances at all.',
        camera: CAM.close,
      }),
      pull('wing-far', [crease([380, 340], PT.BQ, [380, 700], 'mountain', 130)], [400, 620], [220, 700], {
        instruction: 'And the far wing to match.',
        detail: 'Hold the body, not the wings, while you do it.',
      }),
      press('set', {
        instruction: 'Round the wings over a finger and set it down.',
        detail: 'One down. Nine hundred and ninety-nine to go, if you are counting.',
        camera: CAM.desk,
      }),
    ],
  },
}
