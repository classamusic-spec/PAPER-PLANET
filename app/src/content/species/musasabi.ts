/* PAPER PLANET — the Musasabi. A blintz: all four corners in, and a shape with no points at all. */

import { CODEX } from '../codex'
import { eye, sclera } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, blintz, crossFold, flip, press, pull, reverseAt, rotate, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const S = hue(mix(TOKEN.paper3, TOKEN.murasakiDeep, 0.34))

export const musasabi: SpeciesDef = {
  id: 'musasabi',
  name: 'Flying Squirrel',
  binomial: 'Petaurista velans',
  biome: 'nightsky',
  rarity: 'rare',
  material: { front: S.base, back: TOKEN.paperBack },
  chirp: [2.25, 2.5, 2, 2.25],
  idle: 'fly',
  reward: 48,
  unlock: { type: 'species', id: 'squirrel', mastery: 'master' },
  meta: { tier: 'master', surface: 'air', scale: 1.08, altitude: 0.48, flock: ['squirrel'] },
  codex: CODEX.musasabi,
  art: [
    { pts: '100,44 170,88 178,142 100,170 22,142 30,88', fill: S.base, layer: 0 },
    { pts: '100,44 100,170 22,142 30,88', fill: S.light, layer: 0 },
    { pts: '34,86 22,74 40,72', fill: S.dark, layer: 0 },
    { pts: '166,86 178,74 160,72', fill: S.dark, layer: 0 },
    { pts: '28,140 18,154 40,152', fill: S.dark, layer: 0 },
    { pts: '172,140 182,154 160,152', fill: S.dark, layer: 0 },
    { pts: '76,48 124,48 132,76 100,90 68,76', fill: S.light, layer: 1 },
    { pts: '74,46 66,28 88,42', fill: S.dark, layer: 0 },
    { pts: '126,46 134,28 112,42', fill: S.dark, layer: 0 },
    { pts: '94,78 106,78 100,88', fill: TOKEN.ink, layer: 2 },
    { pts: '86,166 114,166 110,194 90,194', fill: S.dark, layer: 0 },
    { pts: '90,168 110,168 108,192 92,192', fill: S.pale, layer: 0 },
    sclera(84, 62, 9),
    sclera(116, 62, 9),
    eye(84, 62, 5.5),
    eye(116, 62, 5.5),
  ],
  recipe: {
    base: 'none',
    steps: [
      blintz('blintz-a', {
        instruction: 'Bring all four corners in to the middle.',
        detail: 'A blintz. It is named after a folded pastry, and it is the only base with no points in it.',
        camera: CAM.desk,
      }),
      flip('turn', {
        instruction: 'Turn it over.',
      }),
      blintz('blintz-b', {
        instruction: 'And all four corners in again.',
        detail: 'Now it is a small thick square with a soft edge all the way round. That edge is the membrane.',
        camera: CAM.close,
      }),
      crossFold('membrane-left', PT.TR, PT.BL, 0.34, 40, PT.TR, 'valley', 155, {
        instruction: 'Ease one edge outward until it stretches.',
        detail: 'It should be taut, not flat. A gliding membrane is under tension the whole way down.',
        camera: CAM.close,
      }),
      crossFold('membrane-right', PT.TR, PT.BL, 0.66, 40, PT.BL, 'valley', 155, {
        instruction: 'And the opposite edge, the same.',
      }),
      reverseAt('head', PT.TL, PT.BR, 0.24, -22, PT.TL, 'mountain', {
        instruction: 'Reverse a small point out at the front for the head.',
        detail: 'Round, and mostly eyes. It is out at night and needs every photon.',
        camera: CAM.detail,
      }),
      crossFold('ears', PT.TL, PT.BR, 0.16, 46, PT.TL, 'valley', 130, {
        instruction: 'Two small ears above it.',
      }),
      pull('tail', [crease([620, 700], [880, 820], [820, 900], 'valley', 120)], [740, 780], [860, 900], {
        instruction: 'Draw the back edge out into a wide flat tail.',
        detail: 'Flat, not bushy. It is the brake, and it is the last thing to touch the tree.',
        camera: CAM.close,
      }),
      rotate('glide', -18, {
        instruction: 'Turn it a little, as if it were coming in to land.',
      }),
      press('set', {
        instruction: 'Press only the middle. The membrane should stay springy.',
        detail: 'Drop it from a height and it will not fall straight. That is the test.',
        camera: CAM.desk,
      }),
    ],
  },
}
