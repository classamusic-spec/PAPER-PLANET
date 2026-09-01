/* PAPER PLANET — who stands where on the Planet, and who stands with whom. */

import type { KamiInstance, Species } from '../../contracts'
import type { Surface } from '../../content/types'
import { getMeta, getSpecies } from '../../content'

/**
 * Where each kind of creature stands, as a fraction of the world's height.
 *
 * Measured against what the world actually draws, not guessed: the ground
 * begins at 0.48, the pond occupies 0.61-0.70, and the biome tabs cover
 * everything below 0.825. So a walker belongs between the pond and the tabs —
 * standing in the water read as a bug rather than a swim, and standing below
 * them put half the collection behind a button.
 *
 * Flocking never moves a Kami out of its band. A heron cannot stand on the
 * grass to be near the crane; it stands in the water *in front of* the crane,
 * which is what a heron does anyway.
 */
export const BANDS: Record<string, [number, number]> = {
  air: [0.28, 0.44],
  perch: [0.48, 0.56],
  rock: [0.57, 0.63],
  water: [0.62, 0.68],
  ground: [0.72, 0.78],
}

/** Nothing may stand below this: the biome tabs start here. */
export const FLOOR = 0.79

/**
 * How much of the bottom of the world the biome tabs and the dock actually
 * cover, in pixels: the tabs sit 104px up on a phone and are 44 tall, plus a
 * little air. `FLOOR` is a fraction and the chrome is not, so on a short screen
 * the fraction is not enough on its own — a big Kami standing at 0.78 hangs its
 * feet behind a button. This is checked against the drawn box, not the centre.
 */
export const CHROME_PX = 156

/** The field a Kami may stand in, as a fraction of the world's width. */
export const FIELD_L = 0.08
export const FIELD_R = 0.92

/** A Kami's drawn box, as a fraction of the world's width, before its scale. */
export const BOX = 0.17

/** The button never gets smaller than a thumb, however small the creature. */
export const TOUCH_MIN = 44

/**
 * A leaning Kami's axis-aligned box is bigger than the Kami. At the ±9° the
 * flock lean reaches, cos+sin is 1.15; the packing budgets 1.17 so that two
 * neighbours that are geometrically clear still measure clear.
 */
const LEAN_MAX = 9
const ROT_PAD = 1.17

/** Deterministic 0..1 from a string, so a world lays out the same every visit. */
export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

export interface Placed {
  kami: KamiInstance
  species: Species
  /** Normalised world position. */
  x: number
  y: number
  scale: number
  /** Degrees. A Kami in a flock tips toward the middle of it. */
  lean: number
  /** The flock this Kami belongs to here, or null when it keeps to itself. */
  flock: string | null
  /** Species names of the others in that flock, for the label. */
  with: string[]
  /** Seconds into its idle cycle. Flockmates are near-in-step, not in lockstep. */
  phase: number
}

const surfaceOf = (k: KamiInstance): Surface => getMeta(k.speciesId)?.surface ?? 'ground'

/**
 * `meta.flock` names the species a Kami likes to settle near, and it is written
 * one way round — the crane knows about the heron, the heron knows about the
 * crane, but the bee knows about the ladybug and the ladybug only knows about
 * the bee. Read it symmetrically or half the pairs never meet.
 *
 * A species that flocks at all keeps its own company too: two cranes stand
 * together, because a species written as gregarious is gregarious about itself
 * as well. A snail has no `flock` at all and stands alone — beside another
 * snail, but not with it, which is exactly right for a snail.
 */
function flocksWith(a: KamiInstance, b: KamiInstance): boolean {
  const fa = getMeta(a.speciesId)?.flock ?? []
  const fb = getMeta(b.speciesId)?.flock ?? []
  if (fa.includes(b.speciesId) || fb.includes(a.speciesId)) return true
  return a.speciesId === b.speciesId && fa.length > 0
}

interface Unit {
  id: string
  members: KamiInstance[]
  /** True when this is a real gathering rather than one Kami on its own. */
  flock: boolean
  seed: number
}

/** Union-find over everyone present, so a chain (crane–heron–crane) is one flock. */
function gather(here: readonly KamiInstance[]): Unit[] {
  const parent = here.map((_, i) => i)
  const find = (i: number): number => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    let walk = i
    while (parent[walk] !== root) {
      const next = parent[walk]
      parent[walk] = root
      walk = next
    }
    return root
  }
  for (let i = 0; i < here.length; i++) {
    for (let j = i + 1; j < here.length; j++) {
      if (flocksWith(here[i], here[j])) parent[find(i)] = find(j)
    }
  }

  const buckets = new Map<number, KamiInstance[]>()
  for (let i = 0; i < here.length; i++) {
    const root = find(i)
    const list = buckets.get(root)
    if (list) list.push(here[i])
    else buckets.set(root, [here[i]])
  }

  const units: Unit[] = []
  for (const members of buckets.values()) {
    members.sort((a, b) => hash01(a.uid, 4) - hash01(b.uid, 4))
    const id = members.map((m) => m.uid).sort().join('+')
    units.push({ id, members, flock: members.length > 1, seed: hash01(id, 13) })
  }
  // A stable shuffle: the same collection lays out the same way every visit,
  // but two flocks are not filed alphabetically down the field.
  units.sort((a, b) => a.seed - b.seed || (a.id < b.id ? -1 : 1))
  return units
}

/** How far apart two Kami must be, centre to centre, to not touch. */
function halfWidth(scale: number, worldW: number): number {
  return (Math.max(scale * BOX * worldW, TOUCH_MIN) * ROT_PAD) / worldW / 2
}
function halfHeight(scale: number, worldW: number, worldH: number): number {
  return (Math.max(scale * BOX * worldW, TOUCH_MIN) * ROT_PAD) / worldH / 2
}

interface Draft {
  kami: KamiInstance
  species: Species
  x: number
  y: number
  scale: number
  unit: number
  hw: number
  hh: number
  band: string
}

/**
 * Push apart anything that overlaps, along x only — y belongs to the band, and
 * the band was measured against what the world actually draws.
 *
 * Three steps, and all three are needed. Relaxation first: pushing both halves
 * of an overlapping pair apart by half of it spreads the pressure evenly, which
 * a one-directional sweep does not — a sweep packs a crowded row perfectly and
 * then piles the leftovers against the far clamp. Then a hard left-to-right
 * pack, which is what actually *guarantees* the result: every Kami ends up
 * clear of everything to its left that shares vertical space with it. Then one
 * rigid shift of the whole field to put the result back on screen, which cannot
 * reintroduce an overlap because it moves everybody the same distance.
 *
 * Deterministic: the only tie-break is the uid hash, so a world lays out the
 * same way every visit.
 */
function separate(drafts: Draft[], fieldL: number, fieldR: number): void {
  const n = drafts.length
  if (n < 2) return
  const clash = (a: Draft, b: Draft): boolean => Math.abs(a.y - b.y) < a.hh + b.hh
  const bias = drafts.map((d) => hash01(d.kami.uid, 21) - 0.5)

  for (let pass = 0; pass < 40; pass++) {
    let moved = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = drafts[i]
        const b = drafts[j]
        if (!clash(a, b)) continue
        const need = a.hw + b.hw
        let gap = b.x - a.x
        if (Math.abs(gap) >= need) continue
        // Exactly on top of each other: part them the same way every time.
        if (gap === 0) gap = bias[i] <= bias[j] ? -1e-6 : 1e-6
        const push = ((need - Math.abs(gap)) / 2) * 0.62 * Math.sign(gap)
        a.x -= push
        b.x += push
        moved++
      }
    }
    if (moved === 0) break
  }

  const order = drafts.map((_, i) => i).sort((a, b) => drafts[a].x - drafts[b].x || (bias[a] < bias[b] ? -1 : 1))
  for (let oi = 1; oi < n; oi++) {
    const me = drafts[order[oi]]
    for (let oj = 0; oj < oi; oj++) {
      const other = drafts[order[oj]]
      if (!clash(me, other)) continue
      me.x = Math.max(me.x, other.x + me.hw + other.hw)
    }
  }

  let minL = Infinity
  let maxR = -Infinity
  for (const d of drafts) {
    minL = Math.min(minL, d.x - d.hw)
    maxR = Math.max(maxR, d.x + d.hw)
  }
  // If the crowd fits the field, sit it in the field. If it does not, centre it
  // on the world so both ends are the same short pan away.
  const target = maxR - minL <= fieldR - fieldL ? (fieldL + fieldR) / 2 : 0.5
  const shift = target - (minL + maxR) / 2
  for (const d of drafts) d.x += shift
}

/**
 * How far back up the hillside a band may spill when it is crowded.
 *
 * A dozen creatures at 17% of the screen each cannot stand in one row on a
 * phone — the arithmetic is not close, it is out by a factor of two — so a
 * crowded band becomes rows of depth rather than a pile. The ceilings come from
 * the same measurements the bands do: ground may climb to the far bank of the
 * pond but never into it, the pond is the pond, and the sky stops at the HUD.
 */
const SPILL: Record<string, number> = {
  air: 0.24,
  perch: 0.46,
  rock: 0.55,
  water: 0.615,
  ground: 0.555,
}

/** With a pond drawn, the ground gets a near bank and a far bank, and no middle. */
const ROWS_OVER_WATER = 2
const ROWS_MAX = 3

/**
 * How big a Kami is drawn in each row of depth. The band's own depth-scale only
 * spans 8% across a band, which is not enough to read as distance — a back row
 * at the same size looks like a bug, not a hillside.
 */
const ROW_DEPTH = [1, 0.84, 0.72]

/** Shoulder to shoulder still leaves a little daylight between shoulders. */
const PACK = 1.06

/**
 * How wide the world really is. The Kami layer travels 26% of the screen in
 * each direction as you pan, so anything between -0.24 and 1.24 can be brought
 * under a thumb. Past that a Kami exists and cannot be reached, which is worse
 * than a crowded field — so this is the hard budget everything is fitted into.
 */
const REACH = 1.48

/** What fits on the screen you are looking at, with a hair of margin. */
const SCREEN = 0.98

/** The smallest a crowd is allowed to make everybody, before the pan is used. */
const MODEST = 0.74

interface BandPlan {
  /** Row heights, front (nearest) first. */
  rows: number[]
  /** What every member of this band needs side by side, as a fraction of width. */
  need: number
}

/**
 * Lay out one biome.
 *
 * Units — a flock, or one Kami on its own — take the slots, rather than
 * individuals taking them: five strangers occupy five slots, a flock of five
 * occupies one. That is what makes a gathering read as a gathering.
 *
 * Four levers keep everyone clear of everyone else, spent in the order that
 * costs the picture least: rows of depth inside a band; a field widened into
 * the part of the world the pan reaches; the separation pass; and finally
 * drawing the whole biome further away and laying it out again — never past
 * the point where a Kami is smaller than a thumb.
 */
export function placeKami(
  all: readonly KamiInstance[],
  biome: string,
  worldW: number,
  worldH: number,
  options: { water?: boolean; chromeTop?: number } = {},
): Placed[] {
  const here = all.filter((k) => getSpecies(k.speciesId)?.biome === biome)
  if (here.length === 0) return []

  const w = worldW > 0 ? worldW : 390
  const h = worldH > 0 ? worldH : 780
  const floor = Math.min(FLOOR, options.chromeTop ?? 1 - CHROME_PX / h)
  const units = gather(here)

  const byBand = new Map<string, KamiInstance[]>()
  for (const k of here) {
    const key = surfaceOf(k)
    const list = byBand.get(key)
    if (list) list.push(k)
    else byBand.set(key, [k])
  }

  /** One complete attempt at a layout, with every creature drawn `squeeze` smaller. */
  function attempt(squeeze: number): { drafts: Draft[]; extent: number } {
    const grow = (k: KamiInstance, at: number): number =>
      (getMeta(k.speciesId)?.scale ?? 1) * (0.92 + (at - 0.5) * 0.34) * squeeze

    /* ── how deep each band has to stand ───────────────────────────────── */
    const plans = new Map<string, BandPlan>()
    for (const [key, members] of byBand) {
      const [top, bottom] = BANDS[key] ?? BANDS.ground
      const back = SPILL[key] ?? top
      const front = Math.min(bottom, floor)
      const natural = members.map((k) => grow(k, (top + bottom) / 2))
      const need = natural.reduce((sum, sc) => sum + 2 * halfWidth(sc, w), 0) * PACK
      const tallest = Math.max(...natural.map((sc) => 2 * halfHeight(sc, w, h)))

      // Rows only earn their place if they can actually be a row apart, and a
      // pond in the middle of the band leaves two banks and nothing between.
      const cap = key === 'ground' && options.water === true ? ROWS_OVER_WATER : ROWS_MAX
      const roomFor = Math.max(1, Math.min(cap, Math.floor((front - back) / Math.max(tallest, 0.001)) + 1))
      const rows = Math.min(roomFor, Math.max(1, Math.ceil(need / (FIELD_R - FIELD_L))))
      plans.set(key, {
        rows:
          rows === 1
            ? [front]
            : Array.from({ length: rows }, (_, i) => front - ((front - back) * i) / (rows - 1)),
        need,
      })
    }

    /* ── who stands in which row ───────────────────────────────────────────
       Before anything is placed sideways, because a row is horizontal room: a
       flock of three across two rows is two creatures wide, not three, and a
       field of singletons that all pick the front row is a pile.

       A unit takes consecutive rows from wherever it starts, so a gathering
       stacks into a huddle in one place instead of being dealt across the
       field; a unit starts in whichever row has the most room left. */
    interface Seat {
      k: KamiInstance
      band: string
      row: number
      scale: number
      hw: number
    }
    const seats: Seat[][] = units.map(() => [])
    const load = new Map<string, number[]>()
    for (const [key, plan] of plans) load.set(key, plan.rows.map(() => 0))

    units.forEach((unit, ui) => {
      const bands = new Map<string, KamiInstance[]>()
      for (const k of unit.members) {
        const key = surfaceOf(k)
        const list = bands.get(key)
        if (list) list.push(k)
        else bands.set(key, [k])
      }
      for (const [key, members] of bands) {
        const plan = plans.get(key)!
        const rows = plan.rows.length
        const busy = load.get(key)!
        let from = 0
        for (let r = 1; r < rows; r++) if (busy[r] < busy[from]) from = r
        members.forEach((k, j) => {
          const row = (from + j) % rows
          const scale = grow(k, plan.rows[row]) * (ROW_DEPTH[row] ?? 1)
          const hw = halfWidth(scale, w)
          busy[row] += 2 * hw * PACK
          seats[ui].push({ k, band: key, row, scale, hw })
        })
      }
    })

    /* ── how much of the field each unit needs ─────────────────────────────
       Its widest single row, not its total: the rest of it is standing behind
       that row, not beside it. Three cranes shoulder to shoulder are more than
       half a phone across, and given an eighth of the field like everybody else
       they spill over their neighbours until a pumpkin is standing in the
       middle of the flock. The field is then shared out in proportion, so it is
       always exactly filled — gaps between units on a roomy planet, slots
       narrower than their units on a crowded one. */
    const footprint = seats.map((mine) => {
      const rowWidth = new Map<string, number>()
      for (const seat of mine) {
        const key = `${seat.band}/${seat.row}`
        rowWidth.set(key, (rowWidth.get(key) ?? 0) + 2 * seat.hw * PACK)
      }
      return Math.max(...rowWidth.values())
    })
    let widest = 0
    for (const plan of plans.values()) widest = Math.max(widest, plan.need / plan.rows.length)

    /* The world is a screen and a half wide once the pan is counted, and today
       the pan reveals nothing but grass. A crowd is allowed to use some of that
       instead of standing on top of itself; a small collection never needs to,
       so it still lays out inside the screen you are looking at. */
    const fieldW = Math.min(REACH * 0.9, Math.max(FIELD_R - FIELD_L, widest * 1.06))
    const fieldL = 0.5 - fieldW / 2
    const claimed = footprint.reduce((sum, n) => sum + n, 0)
    const share = claimed > fieldW ? fieldW / claimed : 1
    const gap = claimed > fieldW ? 0 : (fieldW - claimed) / units.length
    const slotWidth = footprint.map((n) => n * share + gap)

    /* ── place ─────────────────────────────────────────────────────────── */
    const drafts: Draft[] = []
    let slot = fieldL

    units.forEach((unit, ui) => {
      const cx = slot + slotWidth[ui] / 2
      slot += slotWidth[ui]

      // A flock spanning bands is a diagonal, not a totem pole: the sky half
      // sits a little to one side of the ground half.
      const rank = [...new Set(seats[ui].map((seat) => seat.band))].sort(
        (a, b) => (BANDS[a]?.[0] ?? 0.72) - (BANDS[b]?.[0] ?? 0.72),
      )

      const rows = new Map<string, Seat[]>()
      for (const seat of seats[ui]) {
        const key = `${seat.band}/${seat.row}`
        const list = rows.get(key)
        if (list) list.push(seat)
        else rows.set(key, [seat])
      }

      for (const line of rows.values()) {
        const plan = plans.get(line[0].band)!
        const [top, bottom] = BANDS[line[0].band] ?? BANDS.ground
        const back = SPILL[line[0].band] ?? top
        const fan = unit.flock ? (rank.indexOf(line[0].band) - (rank.length - 1) / 2) * 0.035 : 0

        /* Shoulder to shoulder, then centred on the unit's slot. Packing from
           the real widths rather than a fixed gap is what lets a flock stand
           tight without the separation pass immediately undoing it. */
        let cursor = (-line.reduce((sum, seat) => sum + 2 * seat.hw, 0) * PACK) / 2

        line.forEach((seat, j) => {
          const spaced = cursor + seat.hw * PACK
          cursor += 2 * seat.hw * PACK
          const x = unit.flock
            ? cx + fan + spaced
            : cx + (hash01(seat.k.uid, 1) - 0.5) * Math.min(gap, 0.07)

          let y: number
          if (plan.rows.length > 1) {
            y = plan.rows[seat.row] - hash01(seat.k.uid, 2) * 0.01
          } else if (unit.flock && line.length > 1) {
            // A cluster seen in perspective: the middle of it stands nearest.
            const edge = Math.abs(j - (line.length - 1) / 2) / Math.max(0.5, (line.length - 1) / 2)
            y = bottom - edge * (bottom - top) * 0.72 - hash01(seat.k.uid, 2) * (bottom - top) * 0.14
          } else {
            y = top + hash01(seat.k.uid, 2) * (bottom - top)
          }
          y = Math.min(floor, Math.max(back, y))
          // The lowest a Kami may stand follows its drawn size, so the biggest
          // creature never puts its feet behind the biome tabs on a short
          // screen. Two passes: the clamp needs the size, the size needs y.
          const depth = ROW_DEPTH[seat.row] ?? 1
          y = Math.min(y, Math.max(back, floor - halfHeight(grow(seat.k, y) * depth, w, h)))
          const scale = grow(seat.k, y) * depth

          drafts.push({
            kami: seat.k,
            species: getSpecies(seat.k.speciesId)!,
            x,
            y,
            scale,
            unit: ui,
            hw: halfWidth(scale, w),
            hh: halfHeight(scale, w, h),
            band: seat.band,
          })
        })
      }
    })

    separate(drafts, fieldL, fieldL + fieldW)

    let lo = Infinity
    let hi = -Infinity
    for (const d of drafts) {
      lo = Math.min(lo, d.x - d.hw)
      hi = Math.max(hi, d.x + d.hw)
    }
    return { drafts, extent: hi - lo }
  }

  /* Lay it out, and if it runs off the screen, draw the whole biome further
     away and lay it out again.

     The goal is the largest everyone can be while still all being on the screen
     at once — a planet you have to go looking around to see is a worse planet —
     so this bisects for it rather than taking the first size that fits. The
     floor is MODEST, because a crowd of thumbnails is worse than a crowded
     field; if even MODEST spills past where the pan can reach, the floor drops
     to the touch minimum, because a Kami you cannot press is not a fix at all.

     `attempt` is a few hundred operations on a dozen creatures and this only
     runs when the collection or the window changes. */
  const thumb = TOUCH_MIN / (BOX * w)
  let result = attempt(1)
  if (result.extent > SCREEN) {
    let lo = Math.max(MODEST, thumb)
    let atLo = attempt(lo)
    if (atLo.extent > REACH && lo > thumb) {
      lo = thumb
      atLo = attempt(lo)
    }
    const goal = atLo.extent <= SCREEN ? SCREEN : REACH
    result = atLo
    let hi = 1
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2
      const tried = attempt(mid)
      if (tried.extent <= goal) {
        result = tried
        lo = mid
      } else {
        hi = mid
      }
    }
  }
  const drafts = result.drafts

  // Lean is read off the settled positions, not the wished-for ones, so a Kami
  // the packer had to move still faces the friends it ended up beside.
  const centres = new Map<number, number>()
  units.forEach((_, ui) => {
    const mine = drafts.filter((d) => d.unit === ui)
    centres.set(ui, mine.reduce((sum, d) => sum + d.x, 0) / Math.max(1, mine.length))
  })

  return drafts.map((d) => {
    const unit = units[d.unit]
    const cx = centres.get(d.unit) ?? d.x
    const lean = unit.flock ? Math.max(-LEAN_MAX, Math.min(LEAN_MAX, (cx - d.x) * 55)) : 0
    const mates = unit.flock
      ? [
          ...new Set(
            unit.members
              .filter((m) => m.uid !== d.kami.uid)
              .map((m) => getSpecies(m.speciesId)?.name ?? ''),
          ),
        ].filter(Boolean)
      : []
    // Flockmates share the unit's phase, offset by where they stand: the motion
    // travels along the group like a breath rather than firing all at once.
    const phase = unit.flock
      ? unit.seed * 9 + unit.members.findIndex((m) => m.uid === d.kami.uid) * 0.42
      : hash01(d.kami.uid, 5) * 9
    return {
      kami: d.kami,
      species: d.species,
      x: d.x,
      y: d.y,
      scale: d.scale,
      lean,
      flock: unit.flock ? unit.id : null,
      with: mates,
      phase,
    }
  })
}
