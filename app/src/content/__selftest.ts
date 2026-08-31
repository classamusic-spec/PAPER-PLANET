/* PAPER PLANET — content self-test. Validates the whole corpus. Run: npx tsx src/content/__selftest.ts */

import type {
  BiomeId,
  Crease,
  FoldKind,
  FoldRecipe,
  MasteryTier,
  Rarity,
  UnlockRule,
} from '../contracts'
import { BIOMES, BIOME_SCENERY } from './biomes'
import { CODEX } from './codex'
import {
  BIRD_CP,
  CREASELESS,
  FISH_CP,
  FROG_CP,
  GESTURE_FOR,
  KITE_CP,
  PRELIMINARY_CP,
  SIMPLE_CP,
  TIER_ORDER,
  TIER_STEPS,
  WATERBOMB_CP,
  WINDMILL_CP,
  cross,
  effortOf,
  tierOf,
  type FoldTier,
} from './recipes'
import { SPECIES } from './species/index'
import { WASHI, WASHI_PACKS } from './washi'
import type { SpeciesDef, Surface } from './types'

/* ── harness ─────────────────────────────────────────────────────────────── */

const BOLD = '\u001b[1m'
const DIM = '\u001b[2m'
const RED = '\u001b[31m'
const GREEN = '\u001b[32m'
const OFF = '\u001b[0m'

const failures: string[] = []
let checks = 0

function check(ok: boolean, message: string): void {
  checks++
  if (!ok) failures.push(message)
}

function section(title: string): void {
  console.log(`\n${BOLD}${title}${OFF}`)
}

function line(text: string): void {
  console.log(`  ${text}`)
}

/* ── a small strict XML scanner (there is no DOM in node) ────────────────── */

function parseXml(src: string): { elements: number; depthMax: number } {
  const stack: string[] = []
  let i = 0
  let elements = 0
  let depthMax = 0

  const text = (s: string): void => {
    if (s.includes('<')) throw new Error('stray "<" in text')
    let k = s.indexOf('&')
    while (k >= 0) {
      const semi = s.indexOf(';', k)
      if (semi < 0 || semi - k > 8) throw new Error('unescaped "&" in text')
      k = s.indexOf('&', semi)
    }
  }

  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt < 0) {
      text(src.slice(i))
      break
    }
    text(src.slice(i, lt))

    /* find the end of the tag, stepping over quoted attribute values */
    let j = lt + 1
    let quote: string | null = null
    while (j < src.length) {
      const c = src[j]
      if (quote !== null) {
        if (c === quote) quote = null
        else if (c === '<') throw new Error('"<" inside an attribute value')
      } else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
      j++
    }
    if (j >= src.length) throw new Error('unterminated tag')

    const raw = src.slice(lt + 1, j).trim()
    if (raw.length === 0) throw new Error('empty tag')

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim()
      const open = stack.pop()
      if (open !== name) throw new Error(`</${name}> closes <${open ?? 'nothing'}>`)
    } else {
      const selfClosing = raw.endsWith('/')
      const body = selfClosing ? raw.slice(0, -1) : raw
      const name = body.split(/[\s/]/)[0]
      if (!/^[A-Za-z_][\w.:-]*$/.test(name)) throw new Error(`bad tag name "${name}"`)
      const attrs = body.slice(name.length)
      const attrRe = /\s+[A-Za-z_][\w.:-]*\s*=\s*("[^"]*"|'[^']*')/g
      if (attrs.replace(attrRe, '').trim().length > 0) {
        throw new Error(`unquoted or malformed attribute in <${name}>`)
      }
      elements++
      if (!selfClosing) {
        stack.push(name)
        depthMax = Math.max(depthMax, stack.length)
      }
    }
    i = j + 1
  }
  if (stack.length > 0) throw new Error(`unclosed <${stack[stack.length - 1]}>`)
  return { elements, depthMax }
}

/* ── geometry ────────────────────────────────────────────────────────────── */

const CORNERS: readonly [number, number][] = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]]
const BOUND_LO = -600
const BOUND_HI = 1600

function creaseProblems(c: Crease, where: string): string[] {
  const out: string[] = []
  const [ax, ay] = c.a
  const [bx, by] = c.b

  if (ax === bx && ay === by) out.push(`${where}: axis endpoints coincide`)
  if (Math.hypot(bx - ax, by - ay) < 20) out.push(`${where}: axis is degenerately short`)
  const named: [string, number][] = [['a.x', ax], ['a.y', ay], ['b.x', bx], ['b.y', by]]
  for (const [n, v] of named) {
    if (!Number.isFinite(v)) out.push(`${where}: ${n} is not finite`)
    else if (v < BOUND_LO || v > BOUND_HI) out.push(`${where}: ${n}=${v.toFixed(1)} is far outside the sheet`)
  }
  if (c.side !== 1 && c.side !== -1) out.push(`${where}: side is ${String(c.side)}`)
  if (c.direction !== 'valley' && c.direction !== 'mountain') out.push(`${where}: bad direction`)
  if (!(c.angle >= 0 && c.angle <= 180)) out.push(`${where}: angle ${c.angle} out of 0..180`)

  /* the axis must actually cut the material square, or nothing can fold */
  const signs = CORNERS.map((p) => Math.sign(cross(c.a, c.b, p)))
  const positive = signs.some((s) => s > 0)
  const negative = signs.some((s) => s < 0)
  if (!positive || !negative) out.push(`${where}: axis does not cross the 0..1000 sheet`)
  else if (signs.filter((s) => s === c.side).length === 0) {
    out.push(`${where}: the moving side holds no corner of the sheet`)
  }
  return out
}

/* ── 1. species records ──────────────────────────────────────────────────── */

section('1 · species records')

const ids = new Set<string>()
const HEX = /^#[0-9a-fA-F]{6}$/
const SURFACES: readonly Surface[] = ['ground', 'water', 'air', 'perch', 'burrow', 'rock']
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'mythic']

for (const s of SPECIES) {
  const at = `species/${s.id}`
  check(!ids.has(s.id), `${at}: duplicate id`)
  ids.add(s.id)
  check(/^[a-z][a-z0-9-]*$/.test(s.id), `${at}: id is not a slug`)
  check(s.name.trim().length > 0, `${at}: empty name`)
  check(/^[A-Z][a-z]+ [a-z]+$/.test(s.binomial), `${at}: binomial "${s.binomial}" is not Latin-shaped`)
  check(BIOMES.some((b) => b.id === s.biome), `${at}: unknown biome "${s.biome}"`)
  check(RARITIES.includes(s.rarity), `${at}: unknown rarity`)
  check(HEX.test(s.material.front), `${at}: material.front "${s.material.front}" is not a hex colour`)
  check(HEX.test(s.material.back), `${at}: material.back is not a hex colour`)
  check(s.chirp.length >= 2, `${at}: chirp needs at least two notes`)
  check(s.chirp.every((n) => n > 0.2 && n < 6), `${at}: chirp values must be sane frequency multipliers`)
  check(s.reward > 0, `${at}: reward must be positive`)
  check(s.recipe.steps.length > 0, `${at}: empty recipe`)
  check(s.art.length >= 4, `${at}: art has fewer than four polygons`)
  check(SURFACES.includes(s.meta.surface), `${at}: unknown surface "${s.meta.surface}"`)
  check(s.meta.scale > 0.2 && s.meta.scale < 3, `${at}: implausible planet scale`)
  check(s.meta.altitude >= 0 && s.meta.altitude <= 1, `${at}: altitude out of 0..1`)
  check(TIER_ORDER.includes(s.meta.tier), `${at}: unknown tier`)

  /* codex */
  check(s.codex.fact.trim().length > 40, `${at}: codex fact is too thin to be worth reading`)
  check(s.codex.habitat.trim().length > 10, `${at}: codex habitat missing`)
  check((s.codex.factAdept ?? '').length > 40, `${at}: no Adept fact`)
  check((s.codex.foldLore ?? '').length > 40, `${at}: no Master fold lore`)
  check(
    (CODEX as Record<string, unknown>)[s.id] === s.codex,
    `${at}: codex entry is not the one in codex.ts`,
  )

  /* art */
  let eyes = 0
  for (const [k, poly] of s.art.entries()) {
    const pat = `${at}/art[${k}]`
    const forms = [poly.pts, poly.circle, poly.line].filter((f) => f !== undefined).length
    check(forms === 1, `${pat}: must be exactly one of pts / circle / line`)
    check(HEX.test(poly.fill), `${pat}: fill "${poly.fill}" is not a hex colour`)
    if (poly.layer !== undefined) check([0, 1, 2].includes(poly.layer), `${pat}: layer must be 0, 1 or 2`)
    if (poly.pts !== undefined) {
      const nums = poly.pts.trim().split(/[\s,]+/).map(Number)
      check(nums.length >= 6 && nums.length % 2 === 0, `${pat}: pts must be at least three x,y pairs`)
      check(nums.every((n) => Number.isFinite(n)), `${pat}: pts contains a non-number`)
      check(nums.every((n) => n > -60 && n < 260), `${pat}: pts far outside the 0..200 art box`)
    }
    if (poly.circle !== undefined) check(poly.circle[2] > 0, `${pat}: circle radius must be positive`)
    if (poly.eye === true) eyes++
  }
  check(eyes > 0, `${at}: nothing marked eye:true — it can never blink`)
  check(s.art.some((p) => p.layer === 0), `${at}: no polygon on layer 0`)
}

line(`${SPECIES.length} species, ${ids.size} unique ids`)
line(
  `${SPECIES.reduce((n, s) => n + s.art.length, 0)} art polygons, ` +
    `${SPECIES.reduce((n, s) => n + s.art.filter((p) => p.eye === true).length, 0)} of them eyes`,
)

/* ── 2. recipes: geometry, tiers, gestures, pedagogy ─────────────────────── */

section('2 · recipes')

let creaseCount = 0
let stepCount = 0
const kindTally = new Map<FoldKind, number>()

function auditRecipe(id: string, recipe: FoldRecipe, tier: FoldTier): void {
  const at = `recipe/${id}`
  const stepIds = new Set<string>()
  const [lo, hi] = TIER_STEPS[tier]
  check(
    recipe.steps.length >= lo && recipe.steps.length <= hi,
    `${at}: declared "${tier}" (${lo}-${hi} steps) but has ${recipe.steps.length}`,
  )
  check(tierOf(recipe) === tier, `${at}: step count reads as "${String(tierOf(recipe))}", declared "${tier}"`)

  let firstReverse = -1
  recipe.steps.forEach((step, i) => {
    const sat = `${at}/${step.id}`
    stepCount++
    kindTally.set(step.kind, (kindTally.get(step.kind) ?? 0) + 1)
    check(!stepIds.has(step.id), `${sat}: duplicate step id`)
    stepIds.add(step.id)
    check(
      GESTURE_FOR[step.kind].includes(step.gesture),
      `${sat}: gesture "${step.gesture}" does not fit kind "${step.kind}"`,
    )
    check(step.instruction.trim().length > 8, `${sat}: instruction too short`)
    check(step.instruction.length < 90, `${sat}: instruction is longer than one calm sentence`)
    check(!/[A-Z]{4,}|!/.test(step.instruction), `${sat}: instruction shouts (see BRAND §3)`)
    check(
      step.creases.length > 0 || CREASELESS.includes(step.kind),
      `${sat}: kind "${step.kind}" must lay at least one crease`,
    )
    const hd = Math.hypot(step.hint.to[0] - step.hint.from[0], step.hint.to[1] - step.hint.from[1])
    check(hd > 20, `${sat}: hint vector is too short to read (${hd.toFixed(0)})`)
    check(hd < 2400, `${sat}: hint vector is implausibly long`)
    if (step.targets !== undefined) check(step.targets.length > 0, `${sat}: empty targets array`)
    if (step.effort !== undefined) check([1, 2, 3].includes(step.effort), `${sat}: effort out of 1..3`)
    if (step.kind === 'reverse' && firstReverse < 0) firstReverse = i

    for (const [k, c] of step.creases.entries()) {
      creaseCount++
      checks++
      for (const problem of creaseProblems(c, `${sat}/crease[${k}]`)) failures.push(problem)
      check(
        c.angle > 0 || step.kind === 'crease',
        `${sat}/crease[${k}]: angle 0 is only for a pre-crease, not a "${step.kind}"`,
      )
    }
  })

  /* pedagogy: nothing hard before the hands are warm */
  if (tier === 'simple') {
    const hard = recipe.steps.filter((s) => ['reverse', 'petal', 'squash', 'inflate'].includes(s.kind))
    check(hard.length === 0, `${at}: a Simple fold must not teach ${hard.map((s) => s.kind).join(', ')}`)
  }
  if (firstReverse >= 0) {
    check(firstReverse >= 3, `${at}: an inside reverse fold at step ${firstReverse + 1}, before the hands are warm`)
  }
  if (recipe.base === 'bird' || recipe.base === 'frog') {
    check(tier === 'master' || tier === 'grand', `${at}: the ${recipe.base} base is not a ${tier} fold`)
  }
}

for (const s of SPECIES) auditRecipe(s.id, s.recipe, s.meta.tier)

/* the shared bases, checked as bare crease patterns */
const PATTERNS: [string, Crease[]][] = [
  ['SIMPLE_CP', SIMPLE_CP],
  ['KITE_CP', KITE_CP],
  ['FISH_CP', FISH_CP],
  ['PRELIMINARY_CP', PRELIMINARY_CP],
  ['BIRD_CP', BIRD_CP],
  ['FROG_CP', FROG_CP],
  ['WATERBOMB_CP', WATERBOMB_CP],
  ['WINDMILL_CP', WINDMILL_CP],
]
for (const [name, cp] of PATTERNS) {
  check(cp.length > 0, `${name}: empty crease pattern`)
  cp.forEach((c, k) => {
    checks++
    for (const problem of creaseProblems(c, `${name}[${k}]`)) failures.push(problem)
  })
}

line(`${stepCount} steps across ${SPECIES.length} recipes, ${creaseCount} creases, all geometrically valid`)
line(
  `kinds used: ${[...kindTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} x${n}`)
    .join(', ')}`,
)
line(`crease patterns: ${PATTERNS.map(([n, c]) => `${n}(${c.length})`).join(' ')}`)

/* ── 3. unlocks: references, cycles, reachability ────────────────────────── */

section('3 · progression')

const SKUS = new Set(WASHI_PACKS.map((p) => p.sku))
const MASTERY: readonly MasteryTier[] = ['none', 'novice', 'adept', 'master', 'grand']

for (const s of SPECIES) {
  const u = s.unlock
  const at = `unlock/${s.id}`
  switch (u.type) {
    case 'free':
      break
    case 'collection':
      check(u.count > 0 && u.count < SPECIES.length, `${at}: collection ${u.count} is unreachable`)
      break
    case 'species':
      check(ids.has(u.id), `${at}: requires unknown species "${u.id}"`)
      check(MASTERY.includes(u.mastery), `${at}: unknown mastery tier`)
      check(u.id !== s.id, `${at}: requires itself`)
      break
    case 'biome':
      check(BIOMES.some((b) => b.id === u.id), `${at}: requires unknown biome "${u.id}"`)
      break
    case 'purchase':
      check(SKUS.has(u.sku), `${at}: requires unknown sku "${u.sku}"`)
      break
    case 'goldleaf':
      check(u.cost > 0, `${at}: gold leaf cost must be positive`)
      break
  }
}

/* cycle detection over species→species dependencies */
const deps = new Map<string, string>()
for (const s of SPECIES) if (s.unlock.type === 'species') deps.set(s.id, s.unlock.id)
for (const start of deps.keys()) {
  const seen = new Set<string>([start])
  let node = deps.get(start)
  checks++
  while (node !== undefined) {
    if (seen.has(node)) {
      failures.push(`unlock cycle through "${start}"`)
      break
    }
    seen.add(node)
    node = deps.get(node)
  }
}

/*
 * The reachability walk. Mastery is time: a fold you must reach Adept on cannot
 * gate something that opens the same afternoon, so each mastery tier costs
 * whole waves after the prerequisite is first folded. Gold Leaf has to be
 * earned, so it costs waves too. That makes the wave list below an honest
 * shape of the curve rather than a topological sort.
 */
const MASTERY_WAVES: Record<MasteryTier, number> = { none: 0, novice: 1, adept: 2, master: 3, grand: 4 }
const GOLDLEAF_WAVES = 4

function satisfied(
  rule: UnlockRule,
  owned: Map<string, number>,
  wave: number,
  allowSpending: boolean,
): boolean {
  switch (rule.type) {
    case 'free':
      return true
    case 'collection':
      return owned.size >= rule.count
    case 'species': {
      const got = owned.get(rule.id)
      return got !== undefined && wave >= got + MASTERY_WAVES[rule.mastery]
    }
    case 'biome': {
      const b = BIOMES.find((x) => x.id === rule.id)
      return b !== undefined && owned.size >= b.unlockAt
    }
    case 'purchase':
    case 'goldleaf':
      return allowSpending && wave >= GOLDLEAF_WAVES
  }
}

function walk(allowSpending: boolean): { owned: Map<string, number>; order: string[][] } {
  const owned = new Map<string, number>()
  const order: string[][] = []
  let idle = 0
  for (let wave = 1; wave <= 80 && owned.size < SPECIES.length; wave++) {
    const ready = SPECIES.filter((s) => !owned.has(s.id) && satisfied(s.unlock, owned, wave, allowSpending))
    for (const s of ready) owned.set(s.id, wave)
    order.push(ready.map((s) => s.id))
    idle = ready.length === 0 ? idle + 1 : 0
    if (idle >= 8) break
  }
  return { owned, order }
}

const full = walk(true)
const noSpend = walk(false)
const orphans = SPECIES.filter((s) => !full.owned.has(s.id)).map((s) => s.id)

check(orphans.length === 0, `unreachable from a fresh save: ${orphans.join(', ')}`)
check(full.order.filter((w) => w.length > 0).length >= 8, 'the unlock graph is too flat to be a curve')
check(SPECIES.filter((s) => s.unlock.type === 'free').length >= 1, 'nothing is free — a new player cannot start')
check(
  noSpend.owned.size >= SPECIES.length - 1,
  `${SPECIES.length - noSpend.owned.size} folds need Gold Leaf; a non-paying player must be able to finish`,
)

line(`reachable from a fresh save: ${full.owned.size}/${SPECIES.length} in ${full.order.filter((w) => w.length > 0).length} waves`)
line(`reachable while never spending Gold Leaf: ${noSpend.owned.size}/${SPECIES.length}`)
full.order.forEach((wave, i) => {
  if (wave.length > 0) line(`${DIM}wave ${String(i + 1).padStart(2)}${OFF} ${wave.join(', ')}`)
})

/* ── 4. washi ────────────────────────────────────────────────────────────── */

section('4 · washi')

const washiIds = new Set<string>()
let patternElements = 0
for (const w of WASHI) {
  const at = `washi/${w.id}`
  check(!washiIds.has(w.id), `${at}: duplicate id`)
  washiIds.add(w.id)
  check(w.note.trim().length > 12, `${at}: note is not worth reading`)
  check(HEX.test(w.material.front), `${at}: front "${w.material.front}" is not a hex colour`)
  check(HEX.test(w.material.back), `${at}: back is not a hex colour`)
  if (w.material.foil !== undefined) check(w.material.foil > 0 && w.material.foil <= 1, `${at}: foil out of 0..1`)
  if (w.patternDefs !== undefined) {
    checks++
    try {
      const parsed = parseXml(w.patternDefs)
      patternElements += parsed.elements
      check(parsed.elements > 1, `${at}: pattern def has no content`)
    } catch (err) {
      failures.push(`${at}: pattern def is not well-formed XML — ${(err as Error).message}`)
    }
    const pid = w.material.patternId
    check(pid !== undefined, `${at}: has pattern defs but no patternId`)
    if (pid !== undefined) {
      check(w.patternDefs.includes(`id="${pid}"`), `${at}: patternId "${pid}" is not defined in its own defs`)
      check(w.patternDefs.includes('patternUnits="userSpaceOnUse"'), `${at}: pattern will not tile predictably`)
    }
  } else {
    check(w.material.patternId === undefined, `${at}: names a pattern it does not define`)
  }
  if (w.source.type === 'pack') check(SKUS.has(w.source.sku), `${at}: unknown pack sku "${w.source.sku}"`)
  if (w.source.type === 'sheets') check(w.source.cost > 0, `${at}: sheets cost must be positive`)
  if (w.source.type === 'goldleaf') check(w.source.cost > 0, `${at}: gold leaf cost must be positive`)
  if (w.source.type === 'journal') check(w.source.tier > 0, `${at}: journal tier must be positive`)
}

check(WASHI.filter((w) => w.source.type === 'free').length >= 3, 'too few free papers to start with')
for (const p of WASHI_PACKS) {
  check(p.washi.length >= 3, `pack/${p.sku}: fewer than three papers`)
  for (const id of p.washi) check(washiIds.has(id), `pack/${p.sku}: lists unknown washi "${id}"`)
  const sold = WASHI.filter((w) => w.source.type === 'pack' && w.source.sku === p.sku).map((w) => w.id)
  check(
    sold.length === p.washi.length && sold.every((id) => p.washi.includes(id)),
    `pack/${p.sku}: pack contents and washi sources disagree`,
  )
}
for (const sku of ['pack.kyoto-spring', 'pack.deep-sea', 'pack.midnight-garden', 'pack.suminagashi']) {
  check(SKUS.has(sku), `commerce expects pack "${sku}" and content does not have it`)
}

line(
  `${WASHI.length} papers, ${WASHI.filter((w) => w.patternDefs !== undefined).length} with pattern defs ` +
    `(${patternElements} SVG elements, all well-formed)`,
)
line(`packs: ${WASHI_PACKS.map((p) => `${p.sku} (${p.washi.length})`).join(', ')}`)

/* ── 5. biomes & placement ───────────────────────────────────────────────── */

section('5 · biomes')

const biomeIds = new Set<BiomeId>()
let previousUnlock = -1
for (const b of BIOMES) {
  const at = `biome/${b.id}`
  check(!biomeIds.has(b.id), `${at}: duplicate id`)
  biomeIds.add(b.id)
  check(b.note.trim().length > 12, `${at}: note is not worth reading`)
  check(b.unlockAt >= 0 && b.unlockAt < SPECIES.length, `${at}: unlockAt out of range`)
  check(b.unlockAt > previousUnlock, `${at}: biomes must open in order`)
  previousUnlock = b.unlockAt
  for (const [k, v] of Object.entries(b.palette)) check(HEX.test(v), `${at}: palette.${k} "${v}" is not hex`)
  check(BIOME_SCENERY[b.id] !== undefined, `${at}: no scenery record`)
  check(SPECIES.some((s) => s.biome === b.id), `${at}: no species live here`)
}
check(biomeIds.size === 5, 'there should be exactly five biomes')

for (const s of SPECIES) {
  if (s.meta.surface === 'water') {
    check(BIOME_SCENERY[s.biome].water, `species/${s.id}: needs water, but ${s.biome} has none`)
  }
  if (s.unlock.type === 'biome') {
    check(s.unlock.id === s.biome, `species/${s.id}: unlocked by a biome it does not live in`)
  }
  for (const mate of s.meta.flock ?? []) {
    check(ids.has(mate), `species/${s.id}: flocks with unknown species "${mate}"`)
  }
}

for (const b of BIOMES) {
  const here = SPECIES.filter((s) => s.biome === b.id)
  line(
    `${b.name.padEnd(15)} opens at ${String(b.unlockAt).padStart(2)} kami · ` +
      `${String(here.length).padStart(2)} folds · ambience "${b.ambience}" · ` +
      `${BIOME_SCENERY[b.id].water ? 'has water' : 'dry'}`,
  )
}

/* ── 6. the shape of the roster ──────────────────────────────────────────── */

section('6 · distribution')

const byTier = new Map<FoldTier, SpeciesDef[]>()
for (const s of SPECIES) byTier.set(s.meta.tier, [...(byTier.get(s.meta.tier) ?? []), s])
for (const t of TIER_ORDER) {
  const group = byTier.get(t) ?? []
  const steps = group.map((s) => s.recipe.steps.length)
  check(group.length > 0, `no folds at the "${t}" tier`)
  line(
    `${t.padEnd(8)} ${String(group.length).padStart(2)} folds · ${Math.min(...steps)}-${Math.max(...steps)} steps · ` +
      `mean effort ${(group.reduce((n, s) => n + effortOf(s.recipe), 0) / group.length).toFixed(1)}`,
  )
}
for (const r of RARITIES) {
  line(`${r.padEnd(8)} ${String(SPECIES.filter((s) => s.rarity === r).length).padStart(2)} folds`)
}
check(new Set(SPECIES.map((s) => s.recipe.base)).size >= 6, 'the roster does not use enough of the classical bases')
const baseTally = new Map<string, number>()
for (const s of SPECIES) {
  const b = s.recipe.base ?? 'none'
  baseTally.set(b, (baseTally.get(b) ?? 0) + 1)
}
line(`bases: ${[...baseTally.entries()].map(([b, n]) => `${b} x${n}`).join(', ')}`)

/* ── verdict ─────────────────────────────────────────────────────────────── */

section('verdict')
if (failures.length > 0) {
  for (const f of failures) line(`${RED}FAIL${OFF} ${f}`)
  console.log('')
  throw new Error(`${failures.length} content failures out of ${checks} checks`)
}
line(`${GREEN}all ${checks} checks passed${OFF}`)
console.log('')
