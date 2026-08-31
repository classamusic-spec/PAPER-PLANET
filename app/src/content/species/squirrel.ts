/* PAPER PLANET — the Squirrel. The tail is a fan locked into a reverse fold. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, kiteBase, mountain, press, pull, reverseAt, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const S = hue(mix(TOKEN.kinchaDeep, TOKEN.paper3, 0.35))

export const squirrel: SpeciesDef = {
  id: 'squirrel',
  name: 'Squirrel',
  binomial: 'Sciurus chartae',
  biome: 'forest',
  rarity: 'common',
  material: { front: S.base, back: TOKEN.paperBack },
  chirp: [2, 2.25, 2, 2.5],
  idle: 'hop',
  reward: 20,
  unlock: { type: 'species', id: 'fox', mastery: 'novice' },
  meta: { tier: 'classic', surface: 'perch', scale: 0.8, altitude: 0.22, flock: ['musasabi'] },
  codex: CODEX.squirrel,
  art: [
    { pts: '126,124 172,102 190,58 168,18 136,20 158,48 148,86 120,104', fill: S.light, layer: 0 },
    { pts: '126,124 164,104 180,62 164,28 152,32 166,62 152,92 122,110', fill: S.base, layer: 0 },
    { pts: '64,92 106,74 130,98 134,142 70,148', fill: S.base, layer: 1 },
    { pts: '64,92 100,80 100,146 70,148', fill: S.light, layer: 1 },
    { pts: '82,116 116,110 118,142 84,144', fill: S.pale, layer: 1 },
    { pts: '58,72 88,60 102,84 84,104 58,98', fill: S.base, layer: 1 },
    { pts: '62,68 58,46 78,62', fill: S.dark, layer: 0 },
    { pts: '90,58 98,40 104,62', fill: S.dark, layer: 0 },
    { pts: '58,84 44,86 56,94', fill: TOKEN.ink, layer: 2 },
    { pts: '70,148 60,160 92,152', fill: S.dark, layer: 0 },
    { pts: '120,142 132,156 100,150', fill: S.dark, layer: 0 },
    eye(76, 80, 4.2),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'A small body and one very long point. The point is almost all tail.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold it in half away from you.',
        camera: CAM.side,
      }),
      reverseAt('tail', PT.TL, PT.BR, 0.58, -34, PT.BR, 'mountain', {
        instruction: 'Reverse the long point up behind the body.',
        detail: 'Steep. A squirrel’s tail goes up past its own ears and then thinks about it.',
        camera: CAM.close,
      }),
      pull(
        'fan',
        [
          crease([620, 380], [820, 200], [780, 380], 'valley', 130),
          crease([700, 300], [880, 160], [860, 320], 'mountain', 130),
        ],
        [760, 300],
        [860, 180],
        {
          instruction: 'Fan the tail open, one pleat at a time.',
          detail: 'Three pleats is enough to read as fur. Six is showing off.',
          effort: 3,
          camera: CAM.detail,
        },
      ),
      press('set', {
        instruction: 'Press the body, and curl the tail over a fingertip.',
        camera: CAM.desk,
      }),
    ],
  },
}
