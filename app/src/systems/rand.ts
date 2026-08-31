/* PAPER PLANET — tiny deterministic hash + PRNG. Pure, seedable, no globals. */

/** FNV-1a 32-bit. Stable across runs and platforms — safe to persist against. */
export function hash32(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // h *= 16777619, kept in uint32 without overflowing the float mantissa
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/** A stable 0..1 float from a string. */
export function hashFloat(input: string): number {
  return hash32(input) / 0x100000000
}

/** A seeded, deterministic generator. Same seed → same sequence, forever. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seeded generator from any string. */
export function seededRng(seed: string): () => number {
  return mulberry32(hash32(seed))
}

/** The default source of chance. Injected everywhere so tests can be deterministic. */
export type Rng = () => number
export const systemRng: Rng = () => Math.random()

/** Pick from a list with a given generator. Returns null for an empty list. */
export function pick<T>(list: readonly T[], rng: Rng): T | null {
  if (list.length === 0) return null
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))] ?? null
}

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n
}

export function clamp01(n: number): number {
  return clamp(n, 0, 1)
}
