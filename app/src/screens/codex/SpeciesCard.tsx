/* PAPER PLANET — one card in the Codex grid: a folded Kami, or a silhouette that only teases. */

import { memo } from 'react'
import type { Species } from '../../contracts'
import { Icon, Paper } from '../../ui'
import KamiMark from './KamiMark'

/** Everything one card shows, computed once by the screen — cards hold no state. */
export interface CodexRow {
  species: Species
  folds: number
  /** The printed word: "Novice", "Adept", … */
  tierLabel: string
  locked: boolean
  reason: string
  golden: boolean
  instances: number
  best: number
}

export interface SpeciesCardProps {
  row: CodexRow
  selected: boolean
  onSelect: (id: string) => void
}

/**
 * Locked, unfolded and mastered are told apart by *shape and word*, never by
 * colour: a torn edge and a lock glyph, a fold glyph, or a printed tier.
 */
function SpeciesCardBase({ row, selected, onSelect }: SpeciesCardProps) {
  const { species, folds, tierLabel, locked, golden } = row
  const seen = folds > 0
  const state = seen ? tierLabel : locked ? 'Locked' : 'Ready to fold'
  const label = seen
    ? `${species.name}. ${tierLabel}, folded ${folds} ${folds === 1 ? 'time' : 'times'}.`
    : locked
      ? `${species.name}. Locked. ${row.reason}`
      : `${species.name}. Not folded yet, and ready to fold.`

  return (
    <li className="cx-cell">
      <Paper
        as="button"
        tone={seen ? 0 : 1}
        edge={locked ? 'torn' : 'cut'}
        elevation={selected ? 3 : 1}
        radius="md"
        grain={false}
        seed={species.id}
        className="cx-card pp-target"
        data-state={seen ? 'folded' : locked ? 'locked' : 'open'}
        data-selected={selected ? 'true' : undefined}
        onClick={() => onSelect(species.id)}
        aria-label={label}
        aria-current={selected ? 'true' : undefined}
      >
        <span className="cx-card__plate">
          <KamiMark
            art={species.art}
            name={species.name}
            size="100%"
            mode={seen ? 'folded' : 'silhouette'}
            gold={golden}
            decorative
          />
          {golden && (
            <span className="cx-card__seal" aria-hidden>
              <Icon name="sparkle" size={13} cut={false} />
            </span>
          )}
        </span>
        <span className="cx-card__name">{species.name}</span>
        <span className="cx-card__state">
          {locked ? <Icon name="lock" size={11} cut={false} /> : seen ? null : <Icon name="fold" size={11} cut={false} />}
          <span>{state}</span>
        </span>
      </Paper>
    </li>
  )
}

export const SpeciesCard = memo(SpeciesCardBase)

export default SpeciesCard
