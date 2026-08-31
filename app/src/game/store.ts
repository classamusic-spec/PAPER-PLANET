/* PAPER PLANET — persistence v2 (browser-local): collection, golden variants, fold counts, friendship */
import { useState } from 'react'

const KEY = 'paper-planet-save-v2'
const LEGACY = 'paper-planet-collection-v1'

export interface SaveData {
  collection: string[]
  gold: string[]
  folds: Record<string, number>
  hearts: Record<string, number>
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw)
      return {
        collection: Array.isArray(d.collection) ? d.collection : [],
        gold: Array.isArray(d.gold) ? d.gold : [],
        folds: d.folds && typeof d.folds === 'object' ? d.folds : {},
        hearts: d.hearts && typeof d.hearts === 'object' ? d.hearts : {},
      }
    }
    // migrate v1
    const old = localStorage.getItem(LEGACY)
    if (old) {
      const arr = JSON.parse(old)
      if (Array.isArray(arr)) return { collection: arr.filter((x) => typeof x === 'string'), gold: [], folds: {}, hearts: {} }
    }
  } catch {
    /* corrupted or unavailable storage — start fresh */
  }
  return { collection: [], gold: [], folds: {}, hearts: {} }
}

function persist(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* storage unavailable — play session only */
  }
}

export interface Save {
  data: SaveData
  addFriend: (id: string) => void
  addGold: (id: string) => void
  recordFold: (id: string) => number
  feed: (id: string) => void
}

export function useSave(): Save {
  const [data, setData] = useState<SaveData>(load)
  const update = (fn: (d: SaveData) => SaveData) => {
    setData((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }
  return {
    data,
    addFriend: (id) => update((d) => (d.collection.includes(id) ? d : { ...d, collection: [...d.collection, id] })),
    addGold: (id) => update((d) => (d.gold.includes(id) ? d : { ...d, gold: [...d.gold, id] })),
    recordFold: (id) => {
      let n = 0
      update((d) => {
        n = (d.folds[id] ?? 0) + 1
        return { ...d, folds: { ...d.folds, [id]: n } }
      })
      return n
    },
    feed: (id) => update((d) => ({ ...d, hearts: { ...d.hearts, [id]: (d.hearts[id] ?? 0) + 1 } })),
  }
}

/** Sparkle paper odds: 18% base, guaranteed every 3rd fold of the same friend. */
export function rollSparkle(foldCount: number): boolean {
  if ((foldCount + 1) % 3 === 0) return true
  return Math.random() < 0.18
}
