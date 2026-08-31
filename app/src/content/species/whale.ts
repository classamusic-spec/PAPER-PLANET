/* PAPER PLANET — the Whale. A fish base folded in half, with the flukes reversed up. */

import { CODEX } from '../codex'
import { eye } from '../art'
import { TOKEN, hue, tint } from '../palette'
import { CAM, PT, fishBase, mountain, press, pull, reverseAt, rotate, crease } from '../recipes'
import type { SpeciesDef } from '../types'

const A = hue(TOKEN.ai)

export const whale: SpeciesDef = {
  id: 'whale',
  name: 'Whale',
  binomial: 'Balaena chartae',
  biome: 'shore',
  rarity: 'rare',
  material: { front: A.base, back: TOKEN.paperBack },
  chirp: [0.5, 0.667, 0.5, 0.75],
  idle: 'swim',
  reward: 48,
  unlock: { type: 'species', id: 'turtle', mastery: 'adept' },
  meta: { tier: 'master', surface: 'water', scale: 1.5, altitude: 0, flock: ['fish'] },
  codex: CODEX.whale,
  art: [
    { pts: '168,92 198,60 190,100', fill: A.dark, layer: 0 },
    { pts: '168,112 202,136 186,102', fill: A.dark, layer: 0 },
    { pts: '24,108 58,68 140,62 172,98 158,142 56,146', fill: A.base, layer: 1 },
    { pts: '24,108 58,68 100,64 96,146 56,146', fill: A.light, layer: 1 },
    { pts: '40,120 150,112 158,142 56,146', fill: tint(TOKEN.ai, 0.62), layer: 1 },
    { pts: '86,120 116,124 96,144', fill: A.dark, layer: 1 },
    { pts: '88,58 82,34 94,52', fill: TOKEN.aiSoft, layer: 0 },
    { pts: '96,58 100,28 106,56', fill: TOKEN.aiSoft, layer: 0 },
    { pts: '104,58 116,38 110,60', fill: TOKEN.aiSoft, layer: 0 },
    eye(58, 96, 6),
  ],
  recipe: {
    base: 'fish',
    steps: [
      ...fishBase({ detail: 'Two long points and two fins. The long points are the head and the tail.' }),
      mountain('half', PT.TL, PT.BR, PT.TR, 180, {
        instruction: 'Fold the whole thing in half, away from you.',
        detail: 'It becomes a wedge. The fins end up on the underside, which is where they belong.',
        camera: CAM.side,
      }),
      reverseAt('fluke', PT.TL, PT.BR, 0.82, -28, PT.BR, 'mountain', {
        instruction: 'Tap the tail point and push it up inside.',
        detail: 'This is the last real move. Almost no classical fold finishes on a reverse — this one does.',
        camera: CAM.detail,
      }),
      pull('fin', [crease([420, 560], [720, 700], [520, 720], 'valley', 100)], [560, 660], [520, 760], {
        instruction: 'Ease the near fin out from under.',
        detail: 'Gently. There are six layers in there.',
      }),
      rotate('level', -12, {
        instruction: 'Turn it level on the desk.',
        detail: 'A whale sits nose-down by a few degrees. It looks wrong until you do it.',
      }),
      press('set', {
        instruction: 'Press the back and let the flukes stay wide.',
        camera: CAM.desk,
      }),
    ],
  },
}
