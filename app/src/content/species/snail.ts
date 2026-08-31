/* PAPER PLANET — the Snail. A kite base, a turn on the desk, and a coiled shell. */

import { CODEX } from '../codex'
import { eye, stroke } from '../art'
import { TOKEN, hue, mix, shade } from '../palette'
import { CAM, PT, crossFold, kiteBase, press, pull, rotate, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const S = hue(TOKEN.beni)
const BODY = mix(TOKEN.matcha, TOKEN.paper2, 0.45)

export const snail: SpeciesDef = {
  id: 'snail',
  name: 'Snail',
  binomial: 'Helix volvens',
  biome: 'meadow',
  rarity: 'common',
  material: { front: BODY, back: TOKEN.paperBack },
  chirp: [0.75, 0.667, 0.75],
  idle: 'walk',
  reward: 20,
  unlock: { type: 'collection', count: 5 },
  meta: { tier: 'classic', surface: 'ground', scale: 0.78, altitude: 0.02 },
  codex: CODEX.snail,
  art: [
    stroke(44, 116, 34, 84, shade(TOKEN.matcha, 0.3)),
    stroke(56, 114, 52, 80, shade(TOKEN.matcha, 0.3)),
    { pts: '40,120 120,110 152,120 148,152 44,152', fill: BODY, layer: 0 },
    { pts: '40,120 100,114 96,152 44,152', fill: mix(BODY, TOKEN.paper0, 0.35), layer: 1 },
    { pts: '70,60 110,44 146,66 152,104 128,134 88,136 62,110', fill: S.base, layer: 1 },
    { pts: '88,72 122,74 132,100 112,120 88,116 80,94', fill: S.dark, layer: 1 },
    { pts: '98,88 114,92 110,106 96,104', fill: shade(TOKEN.beniDeep, 0.28), layer: 2 },
    stroke(36, 130, 52, 134),
    eye(33, 80, 6),
    eye(51, 76, 6),
  ],
  recipe: {
    base: 'kite',
    steps: [
      ...kiteBase({ detail: 'The wide end is going to be the shell. It needs the paper.' }),
      crossFold('foot', PT.TL, PT.BR, 0.74, 12, PT.BR, 'valley', 180, {
        instruction: 'Fold the point back to make the foot.',
        detail: 'Long and low. A snail is almost all foot.',
        camera: CAM.close,
      }),
      rotate('turn', -34, {
        instruction: 'Turn the whole thing on the desk.',
        detail: 'Twist with two fingers. The shell wants to be up and to the left.',
      }),
      pull(
        'coil',
        [crease(PT.C, PT.RQ, [800, 200], 'valley', 150)],
        [780, 260],
        [640, 360],
        {
          instruction: 'Roll the wide corner in on itself, once around.',
          detail: 'A spiral is the one shape flat paper will not give you honestly. Everybody cheats it the same way.',
          effort: 3,
          camera: CAM.close,
        },
      ),
      press('set', {
        instruction: 'Press only the foot. Leave the shell round.',
        detail: 'Two pressures in one model — the calm bit of this fold.',
      }),
    ],
  },
}
