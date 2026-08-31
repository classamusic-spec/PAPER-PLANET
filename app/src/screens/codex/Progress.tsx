/* PAPER PLANET — how far the book has been written. The Codex's contents page. */

import { memo, useMemo } from 'react'
import type { Biome, BiomeId } from '../../contracts'
import type { CollectionSummary } from '../../systems'
import { Icon, Meter, plural, spell, spellCap } from '../../ui'

export interface CodexProgressProps {
  summary: CollectionSummary
  /** Every biome in the content, in order, locked or not. */
  biomes: readonly Biome[]
  /** The biomes the save has actually opened. */
  opened: readonly BiomeId[]
  /** Which tab is showing — `all`, or one biome. */
  filter: 'all' | BiomeId
}

interface Line {
  /** The label over the meter. */
  label: string
  ratio: number
  caption: string
  /** One sentence under it, or null when there is nothing worth saying. */
  note: string | null
  ariaLabel: string
}

/**
 * `collectionSummary` has always counted every biome's folds and `Biome.unlockAt`
 * has always said what opens a new one — neither ever reached the screen. This
 * reads them both, and follows whichever tab the player is looking at.
 *
 * Unopened biomes are stated as distance, never as a wall: "three more folds and
 * the Night Sky opens". Nothing here counts down and nothing is ever lost.
 */
function summarise({ summary, biomes, opened, filter }: CodexProgressProps): Line {
  if (filter !== 'all') {
    const biome = biomes.find((b) => b.id === filter)
    const bucket = summary.byBiome[filter] ?? { collected: 0, total: 0 }
    const isOpen = opened.includes(filter) || summary.collected >= (biome?.unlockAt ?? 0)
    const left = Math.max(0, (biome?.unlockAt ?? 0) - summary.collected)
    return {
      label: biome?.name ?? 'This biome',
      ratio: bucket.total > 0 ? bucket.collected / bucket.total : 0,
      caption: `${bucket.collected} / ${bucket.total}`,
      note: isOpen
        ? bucket.collected === bucket.total && bucket.total > 0
          ? 'Every fold here is in the book.'
          : (biome?.note ?? null)
        : `Opens when the book holds ${spell(biome?.unlockAt ?? 0)} folds. ` +
          `${spellCap(left)} to go.`,
      ariaLabel: `${bucket.collected} of ${bucket.total} folds in ${biome?.name ?? 'this biome'}`,
    }
  }

  /* The nearest biome still shut — the one fact that says why to keep folding. */
  const next = biomes
    .filter((b) => !opened.includes(b.id) && summary.collected < b.unlockAt)
    .sort((a, b) => a.unlockAt - b.unlockAt)[0]

  const record: string[] = []
  if (summary.mastered > 0) record.push(`${summary.mastered} at Master or better`)
  if (summary.grand > 0) record.push(`${summary.grand} at Grand`)
  if (summary.golden > 0) record.push(`${summary.golden} folded in gold leaf`)

  const left = next ? Math.max(0, next.unlockAt - summary.collected) : 0

  return {
    label: 'The collection',
    ratio: summary.ratio,
    caption: `${summary.collected} / ${summary.total}`,
    note: next
      ? `${spellCap(left)} more ${plural(left, 'fold', 'folds')} and ${next.name} opens.`
      : record.length > 0
        ? `${record.join(' · ')}.`
        : null,
    ariaLabel: `${summary.collected} of ${summary.total} folds collected`,
  }
}

function CodexProgressBase({ summary, biomes, opened, filter }: CodexProgressProps) {
  const line = useMemo(
    () => summarise({ summary, biomes, opened, filter }),
    [summary, biomes, opened, filter],
  )

  return (
    <section className="cx-progress" aria-label="Your progress">
      <Meter
        value={line.ratio}
        accent="matcha"
        size="md"
        ticks
        label={line.label}
        caption={line.caption}
        ariaLabel={line.ariaLabel}
      />
      {line.note ? (
        <p className="cx-progress__note">
          <Icon name="leaf" size={13} cut={false} />
          <span>{line.note}</span>
        </p>
      ) : null}
    </section>
  )
}

export const CodexProgress = memo(CodexProgressBase)

export default CodexProgress
