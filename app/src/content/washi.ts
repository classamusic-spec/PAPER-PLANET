/* PAPER PLANET — the Washi catalogue: dyed papers and seamless SVG pattern defs. */

import type { Washi } from '../contracts'
import { TOKEN, mix } from './palette'
import type { WashiPack } from './types'

/* ═══════════════════════════════════════════════════════════════════════════
   PATTERN BUILDERS

   Every pattern is a `<pattern patternUnits="userSpaceOnUse">` whose motif is
   periodic with the tile, so it repeats without a seam. Motifs that run off an
   edge are drawn again one tile over; motifs that would only half-fit are kept
   whole and inside. All of them are built to read at 24px as well as at 400.
   ═══════════════════════════════════════════════════════════════════════════ */

const n = (v: number): string => (Math.round(v * 1000) / 1000).toString()

function tile(id: string, w: number, h: number, ground: string, body: string): string {
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(w)}" height="${n(h)}">` +
    `<rect width="${n(w)}" height="${n(h)}" fill="${ground}"/>${body}</pattern>`
  )
}

/** Seigaiha — blue ocean waves. Overlapping fans, rows offset by half a fan. */
function seigaiha(id: string, ground: string, line: string): string {
  const paths: string[] = []
  const fan = (cx: number, cy: number): void => {
    for (const rr of [24, 17.5, 11, 5]) {
      paths.push(`<path d="M${n(cx - rr)} ${n(cy)}A${n(rr)} ${n(rr)} 0 0 1 ${n(cx + rr)} ${n(cy)}"/>`)
    }
  }
  for (const cx of [-24, 0, 24, 48, 72]) fan(cx, 24)
  for (const cx of [-12, 12, 36, 60]) fan(cx, 48)
  return tile(id, 48, 48, ground, `<g fill="none" stroke="${line}" stroke-width="1.5">${paths.join('')}</g>`)
}

/** Asanoha — hemp leaf. A triangular lattice with spokes from each centroid. */
function asanoha(id: string, ground: string, line: string): string {
  const s = 60
  const hh = (s * Math.sqrt(3)) / 2
  const lines: string[] = []
  const seg = (a: [number, number], b: [number, number]): void => {
    lines.push(`<path d="M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}"/>`)
  }
  for (let row = -1; row <= 2; row++) {
    for (let col = -1; col <= 2; col++) {
      const ox = col * s + (row % 2 === 0 ? 0 : s / 2)
      const oy = row * hh
      const a: [number, number] = [ox, oy]
      const b: [number, number] = [ox + s, oy]
      const c: [number, number] = [ox + s / 2, oy + hh]
      seg(a, b)
      seg(b, c)
      seg(c, a)
      const g: [number, number] = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]
      seg(g, a)
      seg(g, b)
      seg(g, c)
    }
  }
  return tile(id, s, hh * 2, ground, `<g fill="none" stroke="${line}" stroke-width="1.1">${lines.join('')}</g>`)
}

/** Kikkō — tortoiseshell hexagons. */
function kikko(id: string, ground: string, line: string): string {
  const r = 22
  const w = 3 * r
  const h = Math.sqrt(3) * r
  const hexes: string[] = []
  const hex = (cx: number, cy: number): void => {
    const pts: string[] = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i
      pts.push(`${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`)
    }
    hexes.push(`<path d="M${pts.join('L')}Z"/>`)
  }
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2], [w / 2, -h / 2], [w / 2, h * 1.5]]) {
    hex(cx, cy)
  }
  return tile(id, w, h, ground, `<g fill="none" stroke="${line}" stroke-width="1.3">${hexes.join('')}</g>`)
}

/** Sakura fubuki — a scatter of blossom, every flower whole and inside the tile. */
function sakura(id: string, ground: string, petal: string, heart: string): string {
  const blooms: [number, number, number, number][] = [
    [26, 30, 1, 12],
    [92, 18, 0.78, 47],
    [56, 74, 0.9, -21],
    [116, 96, 0.72, 63],
    [20, 108, 0.84, 32],
    [86, 128, 0.66, -40],
  ]
  const parts = blooms.map(([x, y, sc, rot]) => {
    const petals: string[] = []
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
      petals.push(`<circle cx="${n(Math.cos(a) * 7)}" cy="${n(Math.sin(a) * 7)}" r="4.6" fill="${petal}"/>`)
    }
    return (
      `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(sc)})">` +
      `${petals.join('')}<circle cx="0" cy="0" r="2.2" fill="${heart}"/></g>`
    )
  })
  return tile(id, 150, 150, ground, parts.join(''))
}

/** Shippō — the seven treasures: interlocking circles on a square lattice. */
function shippo(id: string, ground: string, line: string): string {
  const s = 44
  const r = s / Math.SQRT2
  const circles: string[] = []
  for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s], [s / 2, s / 2]]) {
    circles.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/>`)
  }
  return tile(id, s, s, ground, `<g fill="none" stroke="${line}" stroke-width="1.2">${circles.join('')}</g>`)
}

/** Yagasuri — arrow feathers, the pattern on a servant's kimono and a schoolgirl's hakama. */
function yagasuri(id: string, ground: string, ink: string): string {
  const w = 24
  const h = 40
  const shafts: string[] = []
  for (const ox of [0, w]) {
    shafts.push(
      `<path d="M${n(ox - w / 2)} 0L${n(ox)} ${n(h / 2)}L${n(ox - w / 2)} ${n(h)}L${n(ox - w / 2 + 5)} ${n(h)}` +
        `L${n(ox + 5)} ${n(h / 2)}L${n(ox - w / 2 + 5)} 0Z"/>`,
    )
  }
  return tile(id, w, h, ground, `<g fill="${ink}">${shafts.join('')}</g>`)
}

/** Komon — the finest of the small repeats. A dyed haze at arm's length. */
function komon(id: string, ground: string, dot: string, r = 1.5): string {
  const dots = [[5, 5], [15, 15], [15, 5], [5, 15]]
    .map(([x, y], i) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(i % 2 === 0 ? r : r * 0.62)}"/>`)
    .join('')
  return tile(id, 20, 20, ground, `<g fill="${dot}">${dots}</g>`)
}

/** Uroko — scales. Triangles, rank on rank, the skin of a snake or a fish. */
function uroko(id: string, ground: string, scale: string): string {
  const w = 36
  const h = 30
  const tri = (x: number, y: number): string =>
    `<path d="M${n(x)} ${n(y + h / 2)}L${n(x + w / 2)} ${n(y)}L${n(x + w)} ${n(y + h / 2)}Z"/>`
  const body = [tri(-w / 2, 0), tri(w / 2, 0), tri(0, h / 2), tri(w, h / 2), tri(-w, h / 2)].join('')
  return tile(id, w, h, ground, `<g fill="${scale}">${body}</g>`)
}

/** Suminagashi — floating ink. Concentric drifts, each wave a full tile period. */
function suminagashi(id: string, ground: string, dark: string, pale: string): string {
  const w = 200
  const h = 200
  const band = (y: number, amp: number): string =>
    `<path d="M0 ${n(y)}C${n(w * 0.25)} ${n(y - amp)} ${n(w * 0.75)} ${n(y + amp)} ${n(w)} ${n(y)}"/>`
  const heavy: string[] = []
  const light: string[] = []
  for (let i = 0; i < 8; i++) {
    const y = i * 25
    heavy.push(band(y, 9 + (i % 3) * 4))
    light.push(band(y + 12, 6 + ((i + 1) % 3) * 3))
  }
  return tile(
    id,
    w,
    h,
    ground,
    `<g fill="none" stroke="${dark}" stroke-width="2.1">${heavy.join('')}</g>` +
      `<g fill="none" stroke="${pale}" stroke-width="1.1">${light.join('')}</g>`,
  )
}

/** Kinpaku — beaten gold, torn and scattered. */
function kinpaku(id: string, ground: string, gold: string, hi: string): string {
  const flecks: [number, number, number, number, string][] = [
    [18, 22, 9, 14, gold],
    [64, 40, 13, 7, hi],
    [104, 16, 7, 9, gold],
    [38, 78, 6, 11, hi],
    [88, 92, 12, 6, gold],
    [16, 110, 8, 8, gold],
    [112, 118, 6, 12, hi],
    [70, 128, 9, 5, gold],
  ]
  const body = flecks
    .map(([x, y, fw, fh, c], i) =>
      `<rect x="${n(x)}" y="${n(y)}" width="${n(fw)}" height="${n(fh)}" fill="${c}" ` +
      `transform="rotate(${n(i * 23 - 40)} ${n(x + fw / 2)} ${n(y + fh / 2)})"/>`,
    )
    .join('')
  return tile(id, 140, 140, ground, body)
}

/** Hanabishi — the flower diamond, four petals in a lozenge. */
function hanabishi(id: string, ground: string, petal: string): string {
  const s = 56
  const motif = (cx: number, cy: number): string =>
    `<g transform="translate(${n(cx)} ${n(cy)})" fill="${petal}">` +
    `<path d="M0 -14L7 0L0 14L-7 0Z"/><path d="M-14 0L0 -7L14 0L0 7Z"/></g>`
  const body = [motif(0, 0), motif(s, 0), motif(0, s), motif(s, s), motif(s / 2, s / 2)].join('')
  return tile(id, s, s, ground, body)
}

/** Tate-jima — dyed stripes, uneven the way a hand-dyed sheet is uneven. */
function tatejima(id: string, ground: string, a: string, b: string): string {
  const body =
    `<rect x="0" y="0" width="7" height="26" fill="${a}"/>` +
    `<rect x="11" y="0" width="3" height="26" fill="${b}"/>` +
    `<rect x="18" y="0" width="4.5" height="26" fill="${a}"/>`
  return tile(id, 26, 26, ground, body)
}

/** Kasuri — ikat. Threads dyed before weaving, so every cross is a little broken. */
function kasuri(id: string, ground: string, ink: string): string {
  const marks: string[] = []
  for (const [x, y] of [[6, 4], [26, 14], [46, 4], [16, 24], [36, 34], [56, 24], [6, 44], [46, 44]]) {
    marks.push(`<path d="M${n(x)} ${n(y)}h9M${n(x + 4.5)} ${n(y - 4.5)}v9"/>`)
  }
  return tile(id, 60, 60, ground, `<g fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="square">${marks.join('')}</g>`)
}

/** Kumo-gami — cloud paper. Fibre pulled long in the vat while the sheet forms. */
function kumo(id: string, ground: string, fibre: string): string {
  const strands: string[] = []
  for (let i = 0; i < 7; i++) {
    const y = 12 + i * 24
    strands.push(
      `<path d="M0 ${n(y)}C${n(40)} ${n(y - 10)} ${n(120)} ${n(y + 10)} ${n(180)} ${n(y)}" ` +
        `stroke-width="${n(1 + (i % 3) * 1.4)}"/>`,
    )
  }
  return tile(id, 180, 180, ground, `<g fill="none" stroke="${fibre}" stroke-linecap="round" opacity="0.55">${strands.join('')}</g>`)
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CATALOGUE
   ═══════════════════════════════════════════════════════════════════════════ */

const BACK = TOKEN.paperBack

function plain(
  id: string,
  name: string,
  note: string,
  front: string,
  rarity: Washi['rarity'],
  source: Washi['source'],
): Washi {
  return { id, name, note, material: { front, back: BACK }, rarity, source }
}

function patterned(
  id: string,
  name: string,
  note: string,
  front: string,
  defs: string,
  rarity: Washi['rarity'],
  source: Washi['source'],
  foil?: number,
): Washi {
  const material = foil === undefined
    ? { front, back: BACK, patternId: `wp-${id}` }
    : { front, back: mix(BACK, TOKEN.goldHi, 0.3), patternId: `wp-${id}`, foil }
  return { id, name, note, material, patternDefs: defs, rarity, source }
}

export const WASHI: Washi[] = [
  /* ── free: what is in the drawer on day one ──────────────────────────── */
  plain('kozo', 'Kōzo', 'Mulberry bark, beaten and left its own colour.', TOKEN.paper1, 'common', { type: 'free' }),
  plain('beni-zome', 'Beni-zome', 'Safflower. The dye costs more than the paper.', TOKEN.beni, 'common', { type: 'free' }),
  plain('ai-zome', 'Ai-zome', 'Indigo, dipped eight times, and eight times again.', TOKEN.ai, 'common', { type: 'free' }),
  patterned(
    'shiro-komon',
    'Shiro Komon',
    'So fine that from across the room it is simply grey.',
    TOKEN.paper0,
    komon('wp-shiro-komon', TOKEN.paper0, TOKEN.paper3),
    'common',
    { type: 'free' },
  ),

  /* ── sheets: the everyday drawer ──────────────────────────────────────── */
  plain('matcha-zome', 'Matcha-zome', 'Tea green, and it smells faintly of it too.', TOKEN.matcha, 'common', { type: 'sheets', cost: 120 }),
  plain('kincha-zome', 'Kincha-zome', 'Amber. Holds a crease like it was waiting for one.', TOKEN.kincha, 'common', { type: 'sheets', cost: 140 }),
  plain('murasaki-zome', 'Murasaki-zome', 'Purple root. Once, only nobles were allowed it.', TOKEN.murasaki, 'uncommon', { type: 'sheets', cost: 220 }),
  patterned(
    'seigaiha-ai',
    'Seigaiha',
    'Blue ocean waves, rank on rank, going nowhere in particular.',
    TOKEN.ai,
    seigaiha('wp-seigaiha-ai', TOKEN.ai, mix(TOKEN.aiSoft, TOKEN.paper0, 0.35)),
    'common',
    { type: 'sheets', cost: 240 },
  ),
  patterned(
    'asanoha-matcha',
    'Asanoha',
    'Hemp leaf. Put on a child, so the child grows as fast as hemp does.',
    TOKEN.matcha,
    asanoha('wp-asanoha-matcha', TOKEN.matcha, mix(TOKEN.matchaSoft, TOKEN.paper0, 0.3)),
    'common',
    { type: 'sheets', cost: 260 },
  ),
  patterned(
    'kikko-kincha',
    'Kikkō',
    'Tortoiseshell. The tortoise lives ten thousand years, so the pattern is a wish.',
    TOKEN.kincha,
    kikko('wp-kikko-kincha', TOKEN.kincha, mix(TOKEN.kinchaDeep, TOKEN.ink, 0.2)),
    'uncommon',
    { type: 'sheets', cost: 280 },
  ),
  patterned(
    'yagasuri-sumi',
    'Yagasuri',
    'Arrow feathers. An arrow loosed does not come back, so it is given to brides.',
    TOKEN.paper2,
    yagasuri('wp-yagasuri-sumi', TOKEN.paper2, mix(TOKEN.ink, TOKEN.paper2, 0.18)),
    'uncommon',
    { type: 'sheets', cost: 300 },
  ),
  patterned(
    'uroko-beni',
    'Uroko',
    'Scales. Worn to shed bad luck the way a snake sheds a skin.',
    TOKEN.beni,
    uroko('wp-uroko-beni', TOKEN.beni, mix(TOKEN.beniDeep, TOKEN.ink, 0.16)),
    'uncommon',
    { type: 'sheets', cost: 300 },
  ),
  patterned(
    'shippo-murasaki',
    'Shippō',
    'Seven treasures: circles that hold each other and never quite close.',
    TOKEN.murasaki,
    shippo('wp-shippo-murasaki', TOKEN.murasaki, mix(TOKEN.murasakiSoft, TOKEN.paper0, 0.25)),
    'uncommon',
    { type: 'sheets', cost: 320 },
  ),
  patterned(
    'kasuri-ai',
    'Kasuri',
    'The thread is dyed before it is woven, so nothing lines up. That is the point.',
    mix(TOKEN.ai, TOKEN.ink, 0.25),
    kasuri('wp-kasuri-ai', mix(TOKEN.ai, TOKEN.ink, 0.25), TOKEN.aiSoft),
    'uncommon',
    { type: 'sheets', cost: 340 },
  ),
  patterned(
    'tate-sakura',
    'Tate-jima',
    'Hand-dyed stripes. Look closely: not one of them is straight.',
    TOKEN.sakura,
    tatejima('wp-tate-sakura', TOKEN.sakura, TOKEN.sakuraDeep, TOKEN.paper0),
    'common',
    { type: 'sheets', cost: 260 },
  ),

  /* ── pack.kyoto-spring ────────────────────────────────────────────────── */
  patterned(
    'sakura-fubuki',
    'Sakura Fubuki',
    'Blossom snow. It lasts about a week and everyone rearranges their life for it.',
    mix(TOKEN.sakura, TOKEN.paper0, 0.35),
    sakura('wp-sakura-fubuki', mix(TOKEN.sakura, TOKEN.paper0, 0.35), TOKEN.paper0, TOKEN.beni),
    'rare',
    { type: 'pack', sku: 'pack.kyoto-spring' },
  ),
  patterned(
    'hanabishi-beni',
    'Hanabishi',
    'The flower diamond, from a Heian court robe nobody alive has seen.',
    TOKEN.beni,
    hanabishi('wp-hanabishi-beni', TOKEN.beni, mix(TOKEN.sakura, TOKEN.paper0, 0.4)),
    'rare',
    { type: 'pack', sku: 'pack.kyoto-spring' },
  ),
  patterned(
    'wakakusa',
    'Wakakusa',
    'Young grass. The green of the third week of March and no other week.',
    mix(TOKEN.matcha, TOKEN.kincha, 0.28),
    asanoha('wp-wakakusa', mix(TOKEN.matcha, TOKEN.kincha, 0.28), mix(TOKEN.paper0, TOKEN.matchaSoft, 0.3)),
    'rare',
    { type: 'pack', sku: 'pack.kyoto-spring' },
  ),

  /* ── pack.deep-sea ────────────────────────────────────────────────────── */
  patterned(
    'fukami-seigaiha',
    'Fukami',
    'The waves, but at the depth where the light gives up.',
    mix(TOKEN.aiDeep, TOKEN.ink, 0.35),
    seigaiha('wp-fukami-seigaiha', mix(TOKEN.aiDeep, TOKEN.ink, 0.35), mix(TOKEN.ai, TOKEN.aiSoft, 0.5)),
    'rare',
    { type: 'pack', sku: 'pack.deep-sea' },
  ),
  patterned(
    'uroko-ai',
    'Ao-uroko',
    'Scales in indigo. Hold it to the light and it moves.',
    TOKEN.aiDeep,
    uroko('wp-uroko-ai', TOKEN.aiDeep, mix(TOKEN.ai, TOKEN.aiSoft, 0.45)),
    'rare',
    { type: 'pack', sku: 'pack.deep-sea' },
  ),
  patterned(
    'kaigara-kikko',
    'Kaigara',
    'Shell hexagons. The tide leaves them arranged better than you could.',
    mix(TOKEN.aiSoft, TOKEN.paper2, 0.45),
    kikko('wp-kaigara-kikko', mix(TOKEN.aiSoft, TOKEN.paper2, 0.45), TOKEN.ai),
    'rare',
    { type: 'pack', sku: 'pack.deep-sea' },
  ),

  /* ── pack.midnight-garden ─────────────────────────────────────────────── */
  patterned(
    'yozakura',
    'Yozakura',
    'Blossom at night, lit from underneath, which is the only correct way.',
    mix(TOKEN.murasakiDeep, TOKEN.ink, 0.4),
    sakura('wp-yozakura', mix(TOKEN.murasakiDeep, TOKEN.ink, 0.4), TOKEN.sakura, TOKEN.goldHi),
    'rare',
    { type: 'pack', sku: 'pack.midnight-garden' },
  ),
  patterned(
    'hotaru-gami',
    'Hotaru-gami',
    'Fireflies over the river, held still on a sheet.',
    mix(TOKEN.aiDeep, TOKEN.murasakiDeep, 0.45),
    kinpaku('wp-hotaru-gami', mix(TOKEN.aiDeep, TOKEN.murasakiDeep, 0.45), TOKEN.kincha, TOKEN.goldHi),
    'rare',
    { type: 'pack', sku: 'pack.midnight-garden' },
    0.35,
  ),
  patterned(
    'tsukikage',
    'Tsukikage',
    'Moonlight. A grey that is not grey, because nothing here is.',
    mix(TOKEN.ink, TOKEN.murasaki, 0.35),
    komon('wp-tsukikage', mix(TOKEN.ink, TOKEN.murasaki, 0.35), mix(TOKEN.murasakiSoft, TOKEN.ink, 0.25), 1.8),
    'rare',
    { type: 'pack', sku: 'pack.midnight-garden' },
  ),

  /* ── pack.suminagashi ─────────────────────────────────────────────────── */
  patterned(
    'suminagashi-ai',
    'Suminagashi · Ai',
    'Ink floated on water and lifted off in one breath. It cannot be repeated.',
    mix(TOKEN.paper0, TOKEN.aiSoft, 0.3),
    suminagashi('wp-suminagashi-ai', mix(TOKEN.paper0, TOKEN.aiSoft, 0.3), TOKEN.aiDeep, TOKEN.paper0),
    'rare',
    { type: 'pack', sku: 'pack.suminagashi' },
  ),
  patterned(
    'suminagashi-beni',
    'Suminagashi · Beni',
    'The same trick in safflower. Twelve centuries old, still nobody hurries it.',
    mix(TOKEN.paper0, TOKEN.beniSoft, 0.35),
    suminagashi('wp-suminagashi-beni', mix(TOKEN.paper0, TOKEN.beniSoft, 0.35), TOKEN.beniDeep, TOKEN.paper0),
    'rare',
    { type: 'pack', sku: 'pack.suminagashi' },
  ),
  patterned(
    'suminagashi-murasaki',
    'Suminagashi · Murasaki',
    'Purple drifting into purple. Look at it too long and you will miss your train.',
    mix(TOKEN.paper0, TOKEN.murasakiSoft, 0.4),
    suminagashi('wp-suminagashi-murasaki', mix(TOKEN.paper0, TOKEN.murasakiSoft, 0.4), TOKEN.murasakiDeep, TOKEN.paper0),
    'rare',
    { type: 'pack', sku: 'pack.suminagashi' },
  ),

  /* ── gold leaf ────────────────────────────────────────────────────────── */
  patterned(
    'kinpaku',
    'Kinpaku',
    'Gold beaten to one ten-thousandth of a millimetre, then torn on purpose.',
    mix(TOKEN.paper0, TOKEN.kinchaSoft, 0.4),
    kinpaku('wp-kinpaku', mix(TOKEN.paper0, TOKEN.kinchaSoft, 0.4), TOKEN.goldLeaf, TOKEN.goldHi),
    'mythic',
    { type: 'goldleaf', cost: 40 },
    1,
  ),
  patterned(
    'kirakira',
    'Kirakira',
    'Purple ground, gold above. Fold slowly; it shows every hesitation.',
    TOKEN.murasakiDeep,
    kinpaku('wp-kirakira', TOKEN.murasakiDeep, TOKEN.goldHi, TOKEN.goldLeaf),
    'mythic',
    { type: 'goldleaf', cost: 60 },
    0.8,
  ),

  /* ── the Fold Journal ─────────────────────────────────────────────────── */
  patterned(
    'kumo-gami',
    'Kumo-gami',
    'Cloud paper. Long fibres pulled through the vat while the sheet was forming.',
    TOKEN.paper0,
    kumo('wp-kumo-gami', TOKEN.paper0, TOKEN.paper4),
    'uncommon',
    { type: 'journal', tier: 4 },
  ),
  patterned(
    'kin-nagashi',
    'Kin-nagashi',
    'Marbled, then dusted. The gold sits in the troughs of the ink.',
    mix(TOKEN.paper0, TOKEN.kinchaSoft, 0.55),
    suminagashi('wp-kin-nagashi', mix(TOKEN.paper0, TOKEN.kinchaSoft, 0.55), TOKEN.goldLeaf, TOKEN.paper0),
    'rare',
    { type: 'journal', tier: 10 },
    0.5,
  ),
  patterned(
    'senbazuru-gami',
    'Senbazuru-gami',
    'The paper they sell in Kyoto by the thousand sheets, for one wish.',
    mix(TOKEN.beni, TOKEN.paper0, 0.15),
    shippo('wp-senbazuru-gami', mix(TOKEN.beni, TOKEN.paper0, 0.15), TOKEN.goldHi),
    'mythic',
    { type: 'journal', tier: 20 },
    0.4,
  ),
]

/** The four sets Agent D's commerce catalog sells. */
export const WASHI_PACKS: WashiPack[] = [
  {
    sku: 'pack.kyoto-spring',
    name: 'Kyoto Spring',
    note: 'Three papers for the two weeks a year the city is unbearable with people and worth it.',
    accent: 'sakura',
    washi: ['sakura-fubuki', 'hanabishi-beni', 'wakakusa'],
  },
  {
    sku: 'pack.deep-sea',
    name: 'Deep Sea',
    note: 'Indigo down to where the light stops. Three papers.',
    accent: 'ai',
    washi: ['fukami-seigaiha', 'uroko-ai', 'kaigara-kikko'],
  },
  {
    sku: 'pack.midnight-garden',
    name: 'Midnight Garden',
    note: 'Blossom, fireflies and moonlight. Three papers for folding after dark.',
    accent: 'murasaki',
    washi: ['yozakura', 'hotaru-gami', 'tsukikage'],
  },
  {
    sku: 'pack.suminagashi',
    name: 'Marbled Suminagashi',
    note: 'Ink floated on still water. Three sheets, none of them repeatable.',
    accent: 'ink',
    washi: ['suminagashi-ai', 'suminagashi-beni', 'suminagashi-murasaki'],
  },
]

/** The paper a new player starts with. */
export const DEFAULT_WASHI = 'kozo'

/** Washi owned from the very first session. */
export const STARTER_WASHI: readonly string[] = WASHI.filter((w) => w.source.type === 'free').map((w) => w.id)

export function getWashi(id: string): Washi | undefined {
  return WASHI.find((w) => w.id === id)
}

export function getWashiPack(sku: string): WashiPack | undefined {
  return WASHI_PACKS.find((p) => p.sku === sku)
}

/** Every pattern def in one string, for a single `<defs>` block in the app shell. */
export function allPatternDefs(): string {
  return WASHI.map((w) => w.patternDefs).filter((d): d is string => typeof d === 'string').join('')
}
