/* PAPER PLANET — creature & origami-fold data. All art is hand-authored polygons (200x200). */

export interface Poly {
  pts?: string
  circle?: [number, number, number]
  line?: [number, number, number, number]
  fill: string
  noStroke?: boolean
}

export type FoldKind = 'fold' | 'pinch' | 'crease'

export interface FoldStep {
  kind: FoldKind
  paper: string // path d: the whole sheet as it currently looks (400x400 viewBox)
  flap: string // path d: the moving part ('' for crease steps)
  axis: [number, number, number, number] // fold/crease line x1,y1,x2,y2
  arrow: [number, number, number, number] // drag hint from -> to
  instruction: string
  turn?: number // degrees to rotate the table when this step starts
}

export type IdleKind = 'bob' | 'hop' | 'sway' | 'fly' | 'flutter' | 'walk' | 'swim'

export interface Animal {
  id: string
  name: string
  paper: string // sheet front color
  paperBack: string // sheet reverse (white)
  paperDark: string // shadow facet
  art: Poly[]
  chirp: number[]
  fact: string
  idle: IdleKind
  folds: FoldStep[]
  seasonal?: 'autumn' | 'winter'
}

const INSTRUCTIONS = [
  'Drag along the dashed line to fold!',
  'Fold it again — nice and crisp!',
  'One more fold — you’re so close!',
]

function templateA(): FoldStep[] {
  return [
    {
      kind: 'fold',
      paper: 'M100 100 H300 V300 H100 Z',
      flap: 'M300 100 L300 300 L100 300 Z',
      axis: [300, 100, 100, 300],
      arrow: [258, 242, 168, 152],
      instruction: INSTRUCTIONS[0],
    },
    {
      kind: 'fold',
      paper: 'M100 100 L300 100 L100 300 Z',
      flap: 'M100 100 L300 100 L200 200 Z',
      axis: [100, 100, 200, 200],
      arrow: [240, 130, 160, 210],
      instruction: INSTRUCTIONS[1],
      turn: -10,
    },
    {
      kind: 'fold',
      paper: 'M100 100 L200 200 L100 300 Z',
      flap: 'M100 100 L200 200 L100 200 Z',
      axis: [100, 200, 200, 200],
      arrow: [140, 150, 140, 250],
      instruction: INSTRUCTIONS[2],
      turn: 8,
    },
  ]
}

function templateB(): FoldStep[] {
  return [
    {
      kind: 'fold',
      paper: 'M100 100 H300 V300 H100 Z',
      flap: 'M100 100 L100 300 L300 300 Z',
      axis: [100, 100, 300, 300],
      arrow: [150, 255, 245, 165],
      instruction: INSTRUCTIONS[0],
    },
    {
      kind: 'fold',
      paper: 'M100 100 L300 100 L300 300 Z',
      flap: 'M200 100 L300 100 L300 200 Z',
      axis: [200, 100, 300, 200],
      arrow: [275, 135, 225, 185],
      instruction: INSTRUCTIONS[1],
      turn: 12,
    },
    {
      kind: 'fold',
      paper: 'M100 100 L200 100 L300 200 L300 300 Z',
      flap: 'M100 100 L200 100 L200 200 Z',
      axis: [200, 100, 200, 200],
      arrow: [145, 140, 245, 190],
      instruction: INSTRUCTIONS[2],
      turn: -8,
    },
  ]
}

function templateC(): FoldStep[] {
  return [
    {
      kind: 'fold',
      paper: 'M100 100 H300 V300 H100 Z',
      flap: 'M100 100 L200 100 L200 300 L100 300 Z',
      axis: [200, 100, 200, 300],
      arrow: [150, 200, 255, 200],
      instruction: INSTRUCTIONS[0],
    },
    {
      kind: 'fold',
      paper: 'M200 100 L300 100 L300 300 L200 300 Z',
      flap: 'M200 100 L300 100 L300 200 L200 200 Z',
      axis: [200, 200, 300, 200],
      arrow: [250, 150, 250, 255],
      instruction: INSTRUCTIONS[1],
      turn: -12,
    },
    {
      kind: 'fold',
      paper: 'M200 200 L300 200 L300 300 L200 300 Z',
      flap: 'M200 200 L300 200 L300 300 Z',
      axis: [200, 200, 300, 300],
      arrow: [265, 235, 232, 268],
      instruction: INSTRUCTIONS[2],
      turn: 10,
    },
  ]
}

/* ---- sequence builder: interleaves crease-rubs, ends with a corner pinch ---- */

function creaseStep(after: FoldStep, nextPaper: string): FoldStep {
  const [x1, y1, x2, y2] = after.axis
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = (x2 - x1) * 0.22
  const dy = (y2 - y1) * 0.22
  return {
    kind: 'crease',
    paper: nextPaper,
    flap: '',
    axis: after.axis,
    arrow: [mx - dx, my - dy, mx + dx, my + dy],
    instruction: 'Rub the crease — back and forth!',
  }
}

function pinchStep(f: FoldStep): FoldStep {
  return { ...f, kind: 'pinch', instruction: 'Pinch the corner — drag it to the star!' }
}

/** level 2 = fold, rub, fold, pinch (4 steps) · level 3 = fold, rub, fold, rub, pinch (5 steps) */
function buildSeq(tpl: FoldStep[], level: 2 | 3): FoldStep[] {
  const [f1, f2, f3] = tpl
  if (level === 2) return [f1, creaseStep(f1, f2.paper), f2, pinchStep(f3)]
  return [f1, creaseStep(f1, f2.paper), f2, creaseStep(f2, f3.paper), pinchStep(f3)]
}

export const ANIMALS: Animal[] = [
  {
    id: 'crane',
    name: 'Crane',
    paper: '#F28482',
    paperBack: '#FFFDF7',
    paperDark: '#D96464',
    idle: 'fly',
    chirp: [880, 1174.66, 987.77],
    fact: 'In Japan, folding 1,000 paper cranes grants you a wish.',
    folds: buildSeq(templateA(), 2),
    art: [
      { pts: '132,92 178,52 146,112', fill: '#D96464' }, // tail
      { pts: '76,104 128,28 136,96', fill: '#D96464' }, // raised wing
      { pts: '68,100 134,92 112,134 72,132', fill: '#F28482' }, // body
      { pts: '70,102 44,42 88,94', fill: '#F7A8A0' }, // neck
      { pts: '44,42 26,52 54,60', fill: '#F28482' }, // head
      { pts: '28,50 12,56 32,60', fill: '#FFCE80' }, // beak
      { pts: '92,132 96,168 102,132', fill: '#B44F4F' }, // leg
      { pts: '108,132 114,166 118,130', fill: '#B44F4F' }, // leg
      { circle: [40, 48, 3.5], fill: '#563E79', noStroke: true }, // eye
    ],
  },
  {
    id: 'fox',
    name: 'Fox',
    paper: '#F2994A',
    paperBack: '#FFFDF7',
    paperDark: '#D97F35',
    idle: 'walk',
    chirp: [523.25, 392, 523.25, 659.25],
    fact: 'A fox can hear a mouse squeak from 100 feet away!',
    folds: buildSeq(templateB(), 2),
    art: [
      { pts: '58,72 50,22 94,54', fill: '#D97F35' }, // ear L
      { pts: '142,72 150,22 106,54', fill: '#D97F35' }, // ear R
      { pts: '62,64 58,34 86,54', fill: '#FBD9A9' }, // ear L inner
      { pts: '138,64 142,34 114,54', fill: '#FBD9A9' }, // ear R inner
      { pts: '100,48 58,72 66,120 100,150', fill: '#F2994A' }, // head L
      { pts: '100,48 142,72 134,120 100,150', fill: '#E98A3C' }, // head R
      { pts: '82,112 118,112 100,148', fill: '#FDEBD3' }, // snout
      { pts: '93,134 107,134 100,146', fill: '#563E79' }, // nose
      { pts: '74,92 86,88 82,100', fill: '#563E79', noStroke: true }, // eye L
      { pts: '126,92 114,88 118,100', fill: '#563E79', noStroke: true }, // eye R
    ],
  },
  {
    id: 'frog',
    name: 'Frog',
    paper: '#7FB069',
    paperBack: '#FFFDF7',
    paperDark: '#5E8C4A',
    idle: 'hop',
    chirp: [196, 196, 261.63],
    fact: 'Some frogs can jump 20 times their own body length!',
    folds: buildSeq(templateA(), 2),
    art: [
      { pts: '44,120 100,64 156,120 142,162 58,162', fill: '#7FB069' }, // body
      { pts: '44,120 100,64 100,162 58,162', fill: '#93C17D' }, // left facet
      { pts: '74,118 126,118 118,158 82,158', fill: '#C9E4B4' }, // belly
      { pts: '44,150 28,168 66,164', fill: '#5E8C4A' }, // foot L
      { pts: '156,150 172,168 134,164', fill: '#5E8C4A' }, // foot R
      { circle: [72, 60, 17], fill: '#7FB069' }, // eye bump L
      { circle: [128, 60, 17], fill: '#7FB069' }, // eye bump R
      { circle: [72, 60, 11], fill: '#FFFDF7' },
      { circle: [128, 60, 11], fill: '#FFFDF7' },
      { circle: [74, 62, 5.5], fill: '#563E79', noStroke: true },
      { circle: [130, 62, 5.5], fill: '#563E79', noStroke: true },
      { line: [80, 134, 120, 134], fill: '#563E79', noStroke: true }, // smile
    ],
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    paper: '#B497E7',
    paperBack: '#FFFDF7',
    paperDark: '#9C7BD1',
    idle: 'flutter',
    chirp: [1046.5, 1318.51, 1567.98],
    fact: 'Butterflies taste their food with their feet.',
    folds: buildSeq(templateC(), 2),
    art: [
      { pts: '96,58 36,26 26,78 96,102', fill: '#B497E7' }, // wing L up
      { pts: '104,58 164,26 174,78 104,102', fill: '#9C7BD1' }, // wing R up
      { pts: '96,104 34,88 52,146 96,138', fill: '#F28482' }, // wing L low
      { pts: '104,104 166,88 148,146 104,138', fill: '#D96464' }, // wing R low
      { pts: '95,52 105,52 104,150 96,150', fill: '#563E79' }, // body
      { circle: [100, 44, 9], fill: '#563E79' }, // head
      { line: [96, 38, 84, 20], fill: '#563E79', noStroke: true },
      { line: [104, 38, 116, 20], fill: '#563E79', noStroke: true },
      { circle: [56, 60, 8], fill: '#FFCE80', noStroke: true }, // spots
      { circle: [144, 60, 8], fill: '#FFCE80', noStroke: true },
      { circle: [58, 112, 6], fill: '#FFFDF7', noStroke: true },
      { circle: [142, 112, 6], fill: '#FFFDF7', noStroke: true },
    ],
  },
  {
    id: 'whale',
    name: 'Whale',
    paper: '#7FB3D5',
    paperBack: '#FFFDF7',
    paperDark: '#5499C7',
    idle: 'sway',
    chirp: [330, 440, 392, 523.25],
    fact: 'A blue whale’s heart is as big as a small car.',
    folds: buildSeq(templateB(), 2),
    art: [
      { pts: '168,92 198,60 190,100', fill: '#5499C7' }, // fluke up
      { pts: '168,112 202,136 186,102', fill: '#5499C7' }, // fluke down
      { pts: '24,108 58,68 140,62 172,98 158,142 56,146', fill: '#7FB3D5' }, // body
      { pts: '24,108 58,68 100,64 96,146 56,146', fill: '#93C2DF' }, // facet
      { pts: '40,120 150,112 158,142 56,146', fill: '#C5DFEF' }, // belly
      { pts: '86,120 116,124 96,144', fill: '#5499C7' }, // fin
      { circle: [58, 96, 6], fill: '#563E79', noStroke: true }, // eye
      { pts: '88,58 82,34 94,52', fill: '#AED9E0' }, // spout
      { pts: '96,58 100,28 106,56', fill: '#AED9E0' },
      { pts: '104,58 116,38 110,60', fill: '#AED9E0' },
    ],
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    paper: '#F5CAC3',
    paperBack: '#FFFDF7',
    paperDark: '#E5AFA6',
    idle: 'bob',
    chirp: [783.99, 987.77, 783.99, 1174.66],
    fact: 'A happy rabbit jumps and twists in the air — it’s called a binky!',
    folds: buildSeq(templateC(), 2),
    art: [
      { pts: '80,84 66,14 98,72', fill: '#FDF6EC' }, // ear L
      { pts: '120,84 134,14 102,72', fill: '#FDF6EC' }, // ear R
      { pts: '80,72 73,28 91,66', fill: '#F5CAC3' }, // ear L inner
      { pts: '120,72 127,28 109,66', fill: '#F5CAC3' }, // ear R inner
      { pts: '62,96 100,74 138,96 134,152 66,152', fill: '#FDF6EC' }, // body
      { pts: '100,74 138,96 134,152 100,152', fill: '#F0E4D4' }, // facet
      { pts: '66,152 56,166 90,158', fill: '#F0E4D4' }, // foot L
      { pts: '134,152 144,166 110,158', fill: '#F0E4D4' }, // foot R
      { pts: '94,120 106,120 100,130', fill: '#F28482', noStroke: true }, // nose
      { circle: [82, 104, 5], fill: '#563E79', noStroke: true }, // eye L
      { circle: [118, 104, 5], fill: '#563E79', noStroke: true }, // eye R
      { line: [100, 130, 100, 138], fill: '#563E79', noStroke: true }, // mouth
    ],
  },
  {
    id: 'owl',
    name: 'Owl',
    paper: '#A68A64',
    paperBack: '#FFFDF7',
    paperDark: '#8A6F4D',
    idle: 'sway',
    chirp: [349.23, 293.66, 349.23],
    fact: 'An owl can turn its head 270 degrees — almost all the way around!',
    folds: buildSeq(templateB(), 3),
    art: [
      { pts: '70,52 58,24 88,44', fill: '#8A6F4D' }, // tuft L
      { pts: '130,52 142,24 112,44', fill: '#8A6F4D' }, // tuft R
      { pts: '52,84 36,110 58,124', fill: '#8A6F4D' }, // wing L
      { pts: '148,84 164,110 142,124', fill: '#8A6F4D' }, // wing R
      { pts: '58,60 100,40 142,60 148,120 100,164 52,120', fill: '#A68A64' }, // body
      { pts: '58,60 100,40 100,164 52,120', fill: '#C9B08A' }, // facet
      { pts: '78,108 122,108 100,152', fill: '#E8D9BE' }, // belly
      { circle: [80, 74, 14], fill: '#FFFDF7' },
      { circle: [120, 74, 14], fill: '#FFFDF7' },
      { circle: [82, 76, 6], fill: '#563E79', noStroke: true },
      { circle: [118, 76, 6], fill: '#563E79', noStroke: true },
      { pts: '94,84 106,84 100,96', fill: '#FFCE80' }, // beak
      { pts: '88,164 84,175 96,166', fill: '#FFCE80' }, // foot L
      { pts: '112,164 116,175 104,166', fill: '#FFCE80' }, // foot R
    ],
  },
  {
    id: 'cat',
    name: 'Cat',
    paper: '#9AA5B1',
    paperBack: '#FFFDF7',
    paperDark: '#7D8A99',
    idle: 'bob',
    chirp: [659.25, 830.61, 659.25],
    fact: 'Cats sleep around 16 hours a day. Professional nappers!',
    folds: buildSeq(templateC(), 3),
    art: [
      { pts: '140,120 172,92 178,104 150,132', fill: '#7D8A99' }, // tail
      { pts: '66,108 134,108 142,164 58,164', fill: '#9AA5B1' }, // body
      { pts: '66,108 100,108 100,164 58,164', fill: '#C3CCD6' }, // facet
      { pts: '70,62 66,30 94,50', fill: '#7D8A99' }, // ear L
      { pts: '130,62 134,30 106,50', fill: '#7D8A99' }, // ear R
      { pts: '73,56 71,40 88,50', fill: '#F5CAC3', noStroke: true },
      { pts: '127,56 129,40 112,50', fill: '#F5CAC3', noStroke: true },
      { pts: '68,60 100,44 132,60 130,100 70,100', fill: '#9AA5B1' }, // head
      { pts: '68,60 100,44 100,100 70,100', fill: '#ADB9C4' }, // head facet
      { pts: '82,74 90,74 86,82', fill: '#563E79', noStroke: true }, // eye L
      { pts: '110,74 118,74 114,82', fill: '#563E79', noStroke: true }, // eye R
      { pts: '96,88 104,88 100,95', fill: '#F28482', noStroke: true }, // nose
      { line: [64, 86, 46, 82], fill: '#563E79', noStroke: true }, // whiskers
      { line: [64, 93, 48, 95], fill: '#563E79', noStroke: true },
      { line: [136, 86, 154, 82], fill: '#563E79', noStroke: true },
      { line: [136, 93, 152, 95], fill: '#563E79', noStroke: true },
      { pts: '66,164 86,164 76,152', fill: '#C3CCD6' }, // paw L
      { pts: '114,164 134,164 124,152', fill: '#C3CCD6' }, // paw R
    ],
  },
  {
    id: 'fish',
    name: 'Fish',
    paper: '#F6A54F',
    paperBack: '#FFFDF7',
    paperDark: '#E08A33',
    idle: 'swim',
    chirp: [987.77, 1174.66],
    fact: 'Goldfish can remember things for months — not just seconds!',
    folds: buildSeq(templateA(), 3),
    art: [
      { pts: '132,100 168,74 168,126', fill: '#E08A33' }, // tail
      { pts: '78,68 96,48 104,70', fill: '#E08A33' }, // fin top
      { pts: '84,132 98,148 106,128', fill: '#E08A33' }, // fin bottom
      { pts: '28,100 72,66 120,72 136,100 120,128 72,134', fill: '#F6A54F' }, // body
      { pts: '28,100 72,66 100,70 96,130 72,134', fill: '#FBD9A9' }, // facet
      { line: [84, 80, 84, 120], fill: '#E08A33', noStroke: true }, // gill
      { pts: '22,94 22,106 30,100', fill: '#E08A33' }, // lips
      { circle: [56, 94, 8], fill: '#FFFDF7' },
      { circle: [58, 95, 4], fill: '#563E79', noStroke: true },
    ],
  },
  {
    id: 'turtle',
    name: 'Turtle',
    paper: '#84A59D',
    paperBack: '#FFFDF7',
    paperDark: '#5F8A80',
    idle: 'walk',
    chirp: [440, 523.25],
    fact: 'A turtle’s shell is part of its skeleton — it can never leave home!',
    folds: buildSeq(templateB(), 3),
    art: [
      { pts: '58,108 44,102 56,122', fill: '#93C17D' }, // leg FL
      { pts: '142,108 156,102 144,122', fill: '#93C17D' }, // leg FR
      { pts: '58,140 48,158 72,148', fill: '#93C17D' }, // leg BL
      { pts: '142,140 152,158 128,148', fill: '#93C17D' }, // leg BR
      { pts: '50,110 36,106 48,122', fill: '#93C17D' }, // tail
      { pts: '150,86 176,78 182,96 156,104', fill: '#93C17D' }, // head
      { circle: [170, 86, 4], fill: '#563E79', noStroke: true }, // eye
      { pts: '50,110 64,66 136,66 150,110 136,146 64,146', fill: '#84A59D' }, // shell
      { pts: '64,66 100,66 100,146 64,146', fill: '#A8C4B8' }, // shell facet
      { pts: '82,86 118,86 126,110 118,134 82,134 74,110', fill: '#6E968B' }, // shell plate
    ],
  },
  {
    id: 'penguin',
    name: 'Penguin',
    paper: '#5B6B8C',
    paperBack: '#FFFDF7',
    paperDark: '#46537A',
    idle: 'sway',
    chirp: [587.33, 698.46, 587.33],
    fact: 'Penguins can’t fly in the air — but they “fly” underwater!',
    folds: buildSeq(templateC(), 3),
    art: [
      { pts: '60,92 40,120 58,126', fill: '#46537A' }, // flipper L
      { pts: '140,92 160,120 142,126', fill: '#46537A' }, // flipper R
      { pts: '66,56 100,40 134,56 140,120 124,164 76,164 60,120', fill: '#5B6B8C' }, // body
      { pts: '100,40 134,56 140,120 124,164 100,164', fill: '#46537A' }, // facet
      { pts: '78,58 122,58 118,88 82,88', fill: '#FFFDF7' }, // face
      { pts: '78,84 122,84 118,152 82,152', fill: '#FFFDF7' }, // belly
      { circle: [86, 72, 4.5], fill: '#563E79', noStroke: true },
      { circle: [114, 72, 4.5], fill: '#563E79', noStroke: true },
      { pts: '94,80 106,80 100,92', fill: '#FFCE80' }, // beak
      { pts: '78,164 70,176 92,168', fill: '#FFCE80' }, // foot L
      { pts: '122,164 130,176 108,168', fill: '#FFCE80' }, // foot R
    ],
  },
  {
    id: 'dino',
    name: 'Dino',
    paper: '#9BB068',
    paperBack: '#FFFDF7',
    paperDark: '#7A8F4E',
    idle: 'hop',
    chirp: [220, 196, 261.63],
    fact: 'Some dinosaurs were as small as chickens. Rawr — politely.',
    folds: buildSeq(templateA(), 3),
    art: [
      { pts: '56,116 18,132 26,108', fill: '#9BB068' }, // tail
      { pts: '72,82 78,62 88,78', fill: '#7A8F4E' }, // spikes
      { pts: '94,76 102,56 112,74', fill: '#7A8F4E' },
      { pts: '116,74 126,56 134,80', fill: '#7A8F4E' },
      { pts: '56,84 120,70 150,100 140,146 70,146', fill: '#9BB068' }, // body
      { pts: '124,98 142,140 100,142', fill: '#DCE8C0' }, // belly
      { pts: '128,108 142,116 130,122', fill: '#7A8F4E' }, // tiny arm
      { pts: '80,146 76,170 94,170 96,146', fill: '#7A8F4E' }, // leg L
      { pts: '116,146 114,170 132,170 134,146', fill: '#7A8F4E' }, // leg R
      { pts: '128,52 168,48 178,76 146,92', fill: '#9BB068' }, // head
      { pts: '146,92 178,76 174,92 148,100', fill: '#BCD08E' }, // jaw
      { circle: [156, 64, 6], fill: '#FFFDF7' },
      { circle: [157, 65, 3], fill: '#563E79', noStroke: true },
      { circle: [170, 60, 2], fill: '#563E79', noStroke: true }, // nostril
    ],
  },
  {
    id: 'ladybug',
    name: 'Ladybug',
    paper: '#E4572E',
    paperBack: '#FFFDF7',
    paperDark: '#B23A1F',
    idle: 'flutter',
    chirp: [1567.98, 1318.51],
    fact: 'A ladybug can munch 50 aphids in a single day!',
    folds: buildSeq(templateC(), 3),
    art: [
      { pts: '54,86 40,80 52,98', fill: '#3A2E3F' }, // legs L
      { pts: '52,112 38,114 52,124', fill: '#3A2E3F' },
      { pts: '146,86 160,80 148,98', fill: '#3A2E3F' }, // legs R
      { pts: '148,112 162,114 148,124', fill: '#3A2E3F' },
      { pts: '100,52 148,80 146,130 100,158 54,130 52,80', fill: '#E4572E' }, // shell
      { pts: '52,80 100,52 100,158 54,130', fill: '#F2663B' }, // wing facet
      { pts: '86,40 114,40 122,62 78,62', fill: '#3A2E3F' }, // head
      { line: [90, 40, 80, 24], fill: '#3A2E3F', noStroke: true }, // antennae
      { line: [110, 40, 120, 24], fill: '#3A2E3F', noStroke: true },
      { line: [100, 54, 100, 156], fill: '#B23A1F', noStroke: true }, // split
      { circle: [74, 92, 8], fill: '#3A2E3F', noStroke: true }, // dots
      { circle: [126, 92, 8], fill: '#3A2E3F', noStroke: true },
      { circle: [70, 124, 7], fill: '#3A2E3F', noStroke: true },
      { circle: [130, 124, 7], fill: '#3A2E3F', noStroke: true },
      { circle: [90, 50, 4], fill: '#FFFDF7', noStroke: true }, // eyes
      { circle: [110, 50, 4], fill: '#FFFDF7', noStroke: true },
    ],
  },
  {
    id: 'snail',
    name: 'Snail',
    paper: '#A9BFA3',
    paperBack: '#FFFDF7',
    paperDark: '#8AA382',
    idle: 'walk',
    chirp: [392, 329.63],
    fact: 'A snail can nap for three whole years. Three! Years!',
    folds: buildSeq(templateB(), 2),
    art: [
      { line: [44, 116, 34, 84], fill: '#8AA382', noStroke: true }, // stalks
      { line: [56, 114, 52, 80], fill: '#8AA382', noStroke: true },
      { circle: [33, 80, 6], fill: '#563E79' }, // eyes
      { circle: [51, 76, 6], fill: '#563E79' },
      { pts: '40,120 120,110 152,120 148,152 44,152', fill: '#A9BFA3' }, // body
      { pts: '40,120 100,114 96,152 44,152', fill: '#C2D4BC' }, // body facet
      { pts: '70,60 110,44 146,66 152,104 128,134 88,136 62,110', fill: '#F28482' }, // shell
      { pts: '88,72 122,74 132,100 112,120 88,116 80,94', fill: '#D96464' }, // spiral
      { pts: '98,88 114,92 110,106 96,104', fill: '#B44F4F' }, // spiral core
      { line: [36, 130, 52, 134], fill: '#563E79', noStroke: true }, // smile
    ],
  },
  {
    id: 'octopus',
    name: 'Octopus',
    paper: '#9C7BD1',
    paperBack: '#FFFDF7',
    paperDark: '#7E62B0',
    idle: 'swim',
    chirp: [523.25, 659.25, 783.99],
    fact: 'An octopus has three hearts and nine brains!',
    folds: buildSeq(templateA(), 3),
    art: [
      { pts: '52,92 26,110 54,106', fill: '#7E62B0' }, // arm L
      { pts: '148,92 174,110 146,106', fill: '#7E62B0' }, // arm R
      { pts: '56,104 44,150 70,116', fill: '#7E62B0' }, // tentacles
      { pts: '76,112 70,158 92,118', fill: '#9C7BD1' },
      { pts: '96,116 94,162 112,118', fill: '#7E62B0' },
      { pts: '116,116 120,158 134,112', fill: '#9C7BD1' },
      { pts: '136,108 148,148 152,104', fill: '#7E62B0' },
      { pts: '100,36 142,56 150,104 100,116 50,104 58,56', fill: '#9C7BD1' }, // head
      { pts: '58,56 100,36 100,116 50,104', fill: '#C4B0E8' }, // facet
      { circle: [80, 80, 10], fill: '#FFFDF7' },
      { circle: [120, 80, 10], fill: '#FFFDF7' },
      { circle: [82, 82, 5], fill: '#563E79', noStroke: true },
      { circle: [118, 82, 5], fill: '#563E79', noStroke: true },
      { line: [92, 98, 108, 98], fill: '#563E79', noStroke: true }, // smile
      { circle: [76, 138, 3], fill: '#C4B0E8', noStroke: true }, // suckers
      { circle: [102, 140, 3], fill: '#C4B0E8', noStroke: true },
      { circle: [126, 136, 3], fill: '#C4B0E8', noStroke: true },
    ],
  },
  {
    id: 'bat',
    name: 'Bat',
    paper: '#7A639B',
    paperBack: '#FFFDF7',
    paperDark: '#5E4C7A',
    idle: 'fly',
    chirp: [1318.51, 1567.98, 1318.51],
    fact: 'Bats sleep upside down and can eat 1,000 bugs in an hour!',
    folds: buildSeq(templateB(), 3),
    art: [
      { pts: '96,84 30,54 22,96 44,92 38,120 64,112 66,132 96,116', fill: '#5E4C7A' }, // wing L
      { pts: '104,84 170,54 178,96 156,92 162,120 136,112 134,132 104,116', fill: '#5E4C7A' }, // wing R
      { pts: '86,74 100,60 114,74 112,116 88,116', fill: '#7A639B' }, // body
      { pts: '86,74 100,60 100,116 88,116', fill: '#9B87BC' }, // facet
      { pts: '88,72 84,50 98,64', fill: '#5E4C7A' }, // ear L
      { pts: '112,72 116,50 102,64', fill: '#5E4C7A' }, // ear R
      { circle: [94, 84, 4], fill: '#FFCE80', noStroke: true }, // eyes
      { circle: [106, 84, 4], fill: '#FFCE80', noStroke: true },
      { pts: '96,96 99,96 97,101', fill: '#FFFDF7', noStroke: true }, // fangs
      { pts: '101,96 104,96 103,101', fill: '#FFFDF7', noStroke: true },
    ],
  },
  {
    id: 'pumpkin',
    name: 'Paper Pumpkin',
    paper: '#F2994A',
    paperBack: '#FFFDF7',
    paperDark: '#D97F35',
    idle: 'hop',
    chirp: [392, 523.25, 392],
    fact: 'Pumpkins are 90% water — and 100% Halloween.',
    seasonal: 'autumn',
    folds: buildSeq(templateC(), 3),
    art: [
      { pts: '52,86 76,72 78,134 56,126', fill: '#FBD9A9' }, // lobe L
      { pts: '148,86 124,72 122,134 144,126', fill: '#D97F35' }, // lobe R
      { pts: '70,80 100,66 130,80 136,124 100,146 64,124', fill: '#F2994A' }, // body
      { pts: '70,80 100,66 100,146 64,124', fill: '#F7B26B' }, // facet
      { pts: '94,64 106,64 110,44 96,48', fill: '#84A59D' }, // stem
      { pts: '108,52 128,44 120,62', fill: '#5F8A80' }, // leaf
      { pts: '80,98 92,98 86,110', fill: '#563E79', noStroke: true }, // eye L
      { pts: '108,98 120,98 114,110', fill: '#563E79', noStroke: true }, // eye R
      { pts: '97,114 103,114 100,120', fill: '#563E79', noStroke: true }, // nose
      { pts: '80,126 92,136 100,128 108,136 120,126 116,140 84,140', fill: '#563E79', noStroke: true }, // grin
    ],
  },
  {
    id: 'snowhare',
    name: 'Snow Hare',
    paper: '#CFE3EE',
    paperBack: '#FFFDF7',
    paperDark: '#A8C4D6',
    idle: 'bob',
    chirp: [880, 1046.5, 880],
    fact: 'Snow hares turn white in winter to hide in the snow!',
    seasonal: 'winter',
    folds: buildSeq(templateA(), 3),
    art: [
      { pts: '78,84 62,10 96,70', fill: '#FDF6EC' }, // ear L
      { pts: '122,84 138,10 104,70', fill: '#FDF6EC' }, // ear R
      { pts: '78,70 70,26 90,64', fill: '#CFE3EE' }, // ear L inner
      { pts: '122,70 130,26 110,64', fill: '#CFE3EE' }, // ear R inner
      { pts: '60,96 100,72 140,96 136,154 64,154', fill: '#FDF6EC' }, // body
      { pts: '100,72 140,96 136,154 100,154', fill: '#EAF1F6' }, // facet
      { pts: '70,104 130,104 128,116 72,116', fill: '#F28482' }, // scarf
      { pts: '124,112 140,132 128,138 118,116', fill: '#D96464' }, // scarf tail
      { circle: [82, 98, 5], fill: '#563E79', noStroke: true },
      { circle: [118, 98, 5], fill: '#563E79', noStroke: true },
      { pts: '94,112 106,112 100,122', fill: '#F28482', noStroke: true }, // nose
      { pts: '64,154 54,168 88,160', fill: '#EAF1F6' }, // foot L
      { pts: '136,154 146,168 112,160', fill: '#EAF1F6' }, // foot R
    ],
  },
]

export function getAnimal(id: string): Animal {
  return ANIMALS.find((a) => a.id === id)!
}
