/* PAPER PLANET — the cut-paper scenery library: every prop the biomes are built from. */

/**
 * Which sheet of the biome palette a facet is cut from. Resolved to a CSS
 * custom property on the sector, so one shape serves all five biomes.
 */
export type PropTone = 'far' | 'mid' | 'near' | 'deep' | 'pale' | 'accent' | 'ink'

export interface PropFacet {
  pts: string
  tone: PropTone
  /** Faint facets read as the lit side of a fold. */
  soft?: boolean
}

export interface PropShape {
  /** Design box. The prop's base sits on y = h, and x = w / 2 is its stem. */
  w: number
  h: number
  facets: PropFacet[]
  /** Where a Kami can stand, in design coords. Only props that can be perched on. */
  perch?: [number, number]
  /** Where a Kami can sit on stone, in design coords. */
  rock?: [number, number]
}

/** Which parallax band a prop belongs in, and roughly how big it is drawn. */
export type PropBand = 'far' | 'mid' | 'near'

export const PROP_BAND: Record<string, PropBand> = {
  hill: 'far', ridge: 'far', dune: 'far', moon: 'far', star: 'far',
  cedar: 'mid', pine: 'mid', reed: 'mid', branch: 'mid', lantern: 'mid',
  clover: 'near', stone: 'near', driftwood: 'near', shell: 'near', wave: 'near',
  fern: 'near', stump: 'near', toadstool: 'near', boulder: 'near', cairn: 'near',
}

/* Every shape is scissored from one sheet: solid facets, no floating pieces,
   a lit face and a shadowed face. Nothing is symmetrical. */
export const PROP_ART: Record<string, PropShape> = {
  /* ── far silhouettes ─────────────────────────────────────────────────── */
  hill: {
    w: 420, h: 150,
    facets: [
      { pts: '0,150 96,34 188,18 300,62 420,150', tone: 'far' },
      { pts: '96,34 188,18 214,150 128,150', tone: 'far', soft: true },
      { pts: '188,18 300,62 420,150 306,150', tone: 'deep' },
    ],
  },
  ridge: {
    w: 460, h: 210,
    facets: [
      { pts: '0,210 118,52 176,96 250,10 340,88 460,210', tone: 'far' },
      { pts: '118,52 176,96 150,210 62,210', tone: 'pale', soft: true },
      { pts: '250,10 340,88 460,210 316,210', tone: 'deep' },
      { pts: '250,10 288,46 262,58', tone: 'pale' },
    ],
  },
  dune: {
    w: 480, h: 118,
    facets: [
      { pts: '0,118 130,40 268,22 392,58 480,118', tone: 'far' },
      { pts: '130,40 268,22 300,118 176,118', tone: 'pale', soft: true },
      { pts: '268,22 392,58 480,118 352,118', tone: 'deep' },
    ],
  },
  moon: {
    w: 210, h: 210,
    facets: [
      { pts: '105,4 168,26 204,86 196,156 140,202 66,204 12,152 4,84 40,26', tone: 'pale' },
      { pts: '105,4 168,26 204,86 130,96 74,52', tone: 'accent', soft: true },
      { pts: '78,120 96,110 104,128 86,136', tone: 'far', soft: true },
    ],
  },
  star: {
    w: 46, h: 46,
    facets: [
      { pts: '23,0 29,17 46,23 29,29 23,46 17,29 0,23 17,17', tone: 'pale' },
    ],
  },

  /* ── mid band ────────────────────────────────────────────────────────── */
  cedar: {
    w: 150, h: 300,
    facets: [
      { pts: '68,300 84,300 80,206 72,206', tone: 'deep' },
      { pts: '76,6 20,116 132,116', tone: 'mid' },
      { pts: '76,6 20,116 76,116', tone: 'pale', soft: true },
      { pts: '76,64 8,186 144,186', tone: 'mid' },
      { pts: '76,64 8,186 76,186', tone: 'pale', soft: true },
      { pts: '76,126 0,244 150,244', tone: 'deep' },
      { pts: '76,126 0,244 76,244', tone: 'mid', soft: true },
    ],
    perch: [76, 124],
  },
  pine: {
    w: 128, h: 268,
    facets: [
      { pts: '58,268 72,268 70,190 62,190', tone: 'deep' },
      { pts: '64,4 16,98 112,98', tone: 'mid' },
      { pts: '64,4 16,98 64,98', tone: 'pale', soft: true },
      { pts: '64,72 4,200 124,200', tone: 'deep' },
      { pts: '64,72 4,200 64,200', tone: 'mid', soft: true },
    ],
    perch: [64, 92],
  },
  reed: {
    w: 120, h: 210,
    facets: [
      { pts: '54,210 62,210 70,42 60,40', tone: 'mid' },
      { pts: '60,40 68,4 78,30 70,54', tone: 'accent' },
      { pts: '26,210 34,210 12,88 4,96', tone: 'mid' },
      { pts: '88,210 96,210 116,102 108,94', tone: 'deep' },
      { pts: '108,94 118,64 124,92 116,106', tone: 'accent' },
    ],
    perch: [62, 44],
  },
  branch: {
    w: 260, h: 130,
    facets: [
      { pts: '0,44 96,58 178,50 260,66 258,84 176,68 94,76 0,62', tone: 'deep' },
      { pts: '96,58 128,20 138,26 110,62', tone: 'deep' },
      { pts: '128,20 160,30 148,40 122,32', tone: 'mid' },
      { pts: '178,50 196,88 206,84 190,50', tone: 'deep' },
    ],
    perch: [136, 30],
  },

  /* ── near band ───────────────────────────────────────────────────────── */
  clover: {
    w: 90, h: 74,
    facets: [
      { pts: '44,74 50,74 48,36 42,36', tone: 'mid' },
      { pts: '45,10 22,26 32,44 56,42 64,22', tone: 'near' },
      { pts: '45,10 22,26 44,40', tone: 'pale', soft: true },
      { pts: '68,30 84,20 86,38 72,44', tone: 'near' },
    ],
  },
  stone: {
    w: 110, h: 68,
    facets: [
      { pts: '0,68 14,26 52,8 92,20 110,68', tone: 'near' },
      { pts: '14,26 52,8 58,68 20,68', tone: 'pale', soft: true },
      { pts: '52,8 92,20 110,68 66,68', tone: 'deep' },
    ],
    rock: [54, 12],
  },
  boulder: {
    w: 200, h: 128,
    facets: [
      { pts: '0,128 10,54 62,10 140,18 190,66 200,128', tone: 'near' },
      { pts: '10,54 62,10 92,128 26,128', tone: 'pale', soft: true },
      { pts: '140,18 190,66 200,128 128,128', tone: 'deep' },
      { pts: '62,10 140,18 128,44 74,38', tone: 'mid', soft: true },
    ],
    rock: [96, 16],
  },
  cairn: {
    w: 116, h: 150,
    facets: [
      { pts: '4,150 12,112 104,112 112,150', tone: 'near' },
      { pts: '18,112 24,76 96,76 102,112', tone: 'deep' },
      { pts: '30,76 36,44 86,44 90,76', tone: 'near' },
      { pts: '30,76 36,44 58,44 56,76', tone: 'pale', soft: true },
      { pts: '44,44 50,18 76,22 78,44', tone: 'deep' },
    ],
    rock: [60, 20],
  },
  driftwood: {
    w: 230, h: 78,
    facets: [
      { pts: '0,64 58,44 140,50 230,30 228,52 138,72 56,66 2,78', tone: 'deep' },
      { pts: '58,44 140,50 138,62 56,58', tone: 'pale', soft: true },
      { pts: '140,50 176,16 186,22 152,52', tone: 'deep' },
    ],
    perch: [150, 26],
  },
  shell: {
    w: 96, h: 62,
    facets: [
      { pts: '4,62 20,16 50,2 82,20 92,62', tone: 'pale' },
      { pts: '50,2 82,20 92,62 58,62', tone: 'near', soft: true },
      { pts: '48,10 46,62 38,62 40,12', tone: 'accent', soft: true },
    ],
  },
  wave: {
    w: 260, h: 44,
    facets: [
      { pts: '0,44 46,18 104,32 168,12 232,30 260,44', tone: 'pale', soft: true },
      { pts: '46,18 104,32 96,44 40,44', tone: 'near', soft: true },
    ],
  },
  fern: {
    w: 150, h: 130,
    facets: [
      { pts: '70,130 78,130 82,44 72,44', tone: 'mid' },
      { pts: '74,46 14,20 6,44 66,70', tone: 'near' },
      { pts: '78,46 140,14 148,38 84,70', tone: 'deep' },
      { pts: '74,72 26,66 24,88 70,94', tone: 'near', soft: true },
      { pts: '80,72 128,60 132,84 84,94', tone: 'deep', soft: true },
    ],
  },
  stump: {
    w: 130, h: 96,
    facets: [
      { pts: '12,96 18,34 112,34 118,96', tone: 'deep' },
      { pts: '18,34 46,20 96,22 112,34 64,44', tone: 'near' },
      { pts: '18,34 46,20 60,42 26,50', tone: 'pale', soft: true },
      { pts: '52,30 78,30 76,38 54,38', tone: 'mid', soft: true },
    ],
    perch: [64, 26],
  },
  toadstool: {
    w: 88, h: 88,
    facets: [
      { pts: '36,88 54,88 50,44 40,44', tone: 'pale' },
      { pts: '4,46 26,14 62,12 84,44 44,54', tone: 'accent' },
      { pts: '4,46 26,14 44,20 40,52', tone: 'near', soft: true },
      { pts: '30,26 40,22 42,32 32,34', tone: 'pale', soft: true },
    ],
  },
  lantern: {
    w: 110, h: 240,
    facets: [
      { pts: '50,240 60,240 58,84 48,84', tone: 'deep' },
      { pts: '20,74 42,44 74,44 92,74 86,132 26,132', tone: 'accent' },
      { pts: '20,74 42,44 54,44 50,132 26,132', tone: 'pale', soft: true },
      { pts: '38,34 76,34 78,46 36,46', tone: 'deep' },
      { pts: '26,132 86,132 78,150 34,150', tone: 'deep' },
    ],
    perch: [56, 40],
  },
}

/** Props a Kami can stand on. */
export function perchOf(kind: string): [number, number] | null {
  return PROP_ART[kind]?.perch ?? null
}

/** Props a Kami can sit on the top of. */
export function rockOf(kind: string): [number, number] | null {
  return PROP_ART[kind]?.rock ?? null
}
