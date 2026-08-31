/* PAPER PLANET — reading a share subject out of the game state, and nothing else. */

import { useMemo } from 'react'
import type { KamiInstance } from '../../contracts'
import { getSpecies } from '../../content'
import { useCollection, useGame, useKamiList } from '../../systems'
import { planetCard, specimenCard } from './data'
import type { CardData, CardShape, ShareSubject } from './types'

/** Of several folds of one species, the one worth putting on a card. */
function pick(list: KamiInstance[]): KamiInstance | undefined {
  return list.slice().sort((a, b) => {
    if (a.golden !== b.golden) return a.golden ? -1 : 1
    if (a.quality !== b.quality) return b.quality - a.quality
    return b.foldedAt - a.foldedAt
  })[0]
}

/**
 * The card for a subject, or `null` when the save no longer holds it — a uid
 * can outlive the Kami it named, and a species id can outlive a build.
 */
export function useCardData(subject: ShareSubject, shape: CardShape, now: number): CardData | null {
  const kami = useKamiList()
  const folds = useGame((s) => s.folds)
  const biomes = useGame((s) => s.biomes)
  const summary = useCollection()

  return useMemo(() => {
    if (subject.kind === 'planet') {
      return planetCard({ kami, summary, biomes, shape, now })
    }

    if (subject.kind === 'kami') {
      const instance = kami.find((k) => k.uid === subject.uid)
      const species = instance ? getSpecies(instance.speciesId) : undefined
      if (!instance || !species) return null
      return specimenCard({ species, instance, folds: folds[species.id] ?? 0, now })
    }

    const species = getSpecies(subject.speciesId)
    if (!species) return null
    /* a fold you own is a better card than a fold you have only read about */
    const instance = pick(kami.filter((k) => k.speciesId === species.id))
    return specimenCard({ species, instance, folds: folds[species.id] ?? 0, now })
  }, [subject, kami, folds, biomes, summary, shape, now])
}
