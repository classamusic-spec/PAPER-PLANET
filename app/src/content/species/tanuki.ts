/* PAPER PLANET — the Tanuki. A windmill base opened into a round animal with a mask. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, mix } from '../palette'
import { CAM, PT, crossFold, flip, press, pull, rotate, windmillBase, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const T = hue(mix(TOKEN.kinchaDeep, TOKEN.paper3, 0.28))
const MASK = mix(TOKEN.ink, TOKEN.paper3, 0.18)

export const tanuki: SpeciesDef = {
  id: 'tanuki',
  name: 'Tanuki',
  binomial: 'Nyctereutes plicatus',
  biome: 'forest',
  rarity: 'rare',
  material: { front: T.base, back: TOKEN.paperBack },
  chirp: [0.938, 1.125, 0.938, 0.75],
  idle: 'walk',
  reward: 48,
  unlock: { type: 'species', id: 'fox', mastery: 'master' },
  meta: { tier: 'master', surface: 'ground', scale: 1.05, altitude: 0.02, flock: ['fox'] },
  codex: CODEX.tanuki,
  art: [
    { pts: '148,124 178,116 190,134 172,152 146,148', fill: T.dark, layer: 0 },
    { pts: '158,122 178,118 186,132 164,140', fill: T.light, layer: 0 },
    { pts: '54,102 100,74 146,102 152,142 128,164 68,164 46,140', fill: T.base, layer: 1 },
    { pts: '54,102 100,74 100,164 68,164 46,140', fill: T.light, layer: 1 },
    { pts: '78,128 122,128 126,158 74,158', fill: T.pale, layer: 1 },
    { pts: '62,84 56,54 88,72', fill: T.dark, layer: 0 },
    { pts: '138,84 144,54 112,72', fill: T.dark, layer: 0 },
    { pts: '64,96 92,88 96,110 66,112', fill: MASK, layer: 1 },
    { pts: '136,96 108,88 104,110 134,112', fill: MASK, layer: 1 },
    { pts: '94,110 106,110 100,120', fill: TOKEN.ink, layer: 2 },
    { pts: '66,164 58,178 88,168', fill: T.dark, layer: 0 },
    { pts: '134,164 142,178 112,168', fill: T.dark, layer: 0 },
    eye(78, 100, 4.4, TOKEN.paper0),
    eye(122, 100, 4.4, TOKEN.paper0),
  ],
  recipe: {
    base: 'windmill',
    steps: [
      ...windmillBase({ detail: 'Four vanes: two ears, a tail and a pair of feet. Nothing wasted.' }),
      flip('turn', {
        instruction: 'Turn the windmill over.',
        detail: 'The smooth side is the front of the animal.',
      }),
      crossFold('ear-left', PT.TL, PT.BR, 0.2, 46, PT.TL, 'valley', 150, {
        instruction: 'Fold one vane up into a small round ear.',
        detail: 'Round, not pointed — fold the tip back on itself once.',
        camera: CAM.close,
      }),
      crossFold('ear-right', PT.TL, PT.BR, 0.2, -46, PT.TL, 'valley', 150, {
        instruction: 'And the other ear to match.',
      }),
      crossFold('mask', PT.TL, PT.BR, 0.36, 0, PT.TL, 'mountain', 165, {
        instruction: 'Turn a band of the reverse side across the eyes.',
        detail: 'That dark band is the whole face. Without it this is a bear.',
        camera: CAM.close,
      }),
      pull('tail', [crease([680, 620], [900, 760], [880, 620], 'valley', 120)], [780, 660], [900, 700], {
        instruction: 'Draw the back vane out into a thick tail.',
        detail: 'Fat and blunt. A tanuki tail is a cushion, not a brush.',
      }),
      rotate('settle', -14, {
        instruction: 'Turn it a little on the desk.',
      }),
      press('set', {
        instruction: 'Press it flat and round the back over your palm.',
        detail: 'It should look like it has just eaten something it should not have.',
        camera: CAM.desk,
      }),
    ],
  },
}
