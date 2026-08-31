/* PAPER PLANET — one Codex page: the creature, its record, and everything mastery has opened. */

import { useMemo } from 'react'
import type { MasteryTier, Species } from '../../contracts'
import { getBiome, MASTERY_LABEL, MASTERY_NOTE, visibleCodex } from '../../content'
import {
  actions,
  useActiveWashi,
  useFoldCount,
  useGoldLeaf,
  useKamiOfSpecies,
  useMasteryProgress,
  useUnlock,
} from '../../systems'
import { audio, haptics } from '../../audio'
import { Button, Chip, Icon, Meter, Paper, useToast } from '../../ui'
import KamiMark from './KamiMark'

const RARITY_LABEL: Record<Species['rarity'], string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
}

/** Rarity has a dye, but it never carries the meaning on its own — the word does. */
const RARITY_ACCENT: Record<Species['rarity'], 'ink' | 'matcha' | 'ai' | 'murasaki'> = {
  common: 'ink',
  uncommon: 'matcha',
  rare: 'ai',
  mythic: 'murasaki',
}

const TIER_RAIL: readonly MasteryTier[] = ['novice', 'adept', 'master', 'grand']

const RANK: Record<MasteryTier, number> = { none: 0, novice: 1, adept: 2, master: 3, grand: 4 }

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export interface SpeciesDetailProps {
  species: Species
  /** The Sheet already prints the name and binomial; do not print them twice. */
  compactHeading?: boolean
  /** Called after navigation, so a phone Sheet can close itself. */
  onLeave?: () => void
  onFold: (speciesId: string) => void
}

export function SpeciesDetail({ species, compactHeading = false, onLeave, onFold }: SpeciesDetailProps) {
  const folds = useFoldCount(species.id)
  const mastery = useMasteryProgress(species.id)
  const unlock = useUnlock(species.id)
  const kami = useKamiOfSpecies(species.id)
  const goldLeaf = useGoldLeaf()
  const activeWashi = useActiveWashi()
  const toast = useToast()

  const biome = getBiome(species.biome)
  const entry = useMemo(() => visibleCodex(species.codex, mastery.tier), [species.codex, mastery.tier])

  const best = kami.reduce((m, k) => Math.max(m, k.quality), 0)
  const golden = kami.filter((k) => k.golden).length
  const foldable = unlock?.unlocked ?? true
  const seen = folds > 0

  /* The next page of writing is always exactly one tier away, so the invitation
     can be exact without this screen ever restating a threshold table. */
  const toNext = mastery.foldsToNext
  const nextTier = mastery.next

  const openWithGoldLeaf = (): void => {
    const result = actions.unlockSpeciesWithGoldLeaf(species.id)
    if (result.ok) {
      audio.play('reward.unlock')
      haptics.fire('reward')
      toast.show({ title: `${species.name} is open.`, note: 'The paper is on the desk when you are.', icon: 'crane', accent: 'gold-leaf' })
    } else {
      toast.show({ title: result.reason ?? 'Not yet.', accent: 'ink', cue: 'ui.close' })
    }
  }

  const fold = (): void => {
    onFold(species.id)
    onLeave?.()
  }

  return (
    <article className="cx-detail" aria-label={`${species.name} codex entry`}>
      {/* ── the specimen ───────────────────────────────────────────────── */}
      <div className="cx-detail__hero">
        <div className="cx-detail__plate" data-seen={seen ? 'true' : 'false'}>
          <KamiMark
            art={species.art}
            name={species.name}
            size="100%"
            mode={seen ? 'folded' : 'silhouette'}
            gold={golden > 0}
            decorative
            className={seen ? 'cx-alive' : undefined}
          />
        </div>
        {!compactHeading && (
          <div className="cx-detail__names">
            <h2>{species.name}</h2>
            <p className="cx-binomial">{species.binomial}</p>
          </div>
        )}
      </div>

      <div className="cx-detail__chips">
        <Chip tone="wash" accent={RARITY_ACCENT[species.rarity]} dot seed={`r-${species.id}`}>
          {RARITY_LABEL[species.rarity]}
        </Chip>
        <Chip tone="plain" icon="leaf" seed={`b-${species.id}`}>
          {biome?.name ?? species.biome}
        </Chip>
        {golden > 0 && (
          <Chip tone="wash" accent="gold-leaf" icon="sparkle" seed={`g-${species.id}`}>
            Gold leaf {golden > 1 ? `× ${golden}` : ''}
          </Chip>
        )}
      </div>

      {/* ── mastery ────────────────────────────────────────────────────── */}
      <section className="cx-block" aria-labelledby={`m-${species.id}`}>
        <h3 className="pp-label cx-block__label" id={`m-${species.id}`}>
          Mastery
        </h3>
        <p className="cx-tier">{MASTERY_LABEL[mastery.tier]}</p>
        <Meter
          value={mastery.ratio}
          accent="kincha"
          size="md"
          ticks
          ariaLabel={
            nextTier
              ? `${toNext} more ${plural(toNext, 'fold', 'folds')} to ${MASTERY_LABEL[nextTier]}`
              : 'Mastery complete'
          }
          caption={
            nextTier
              ? `${toNext} more to ${MASTERY_LABEL[nextTier]}`
              : 'Nothing left to reach'
          }
          label={`${folds} ${plural(folds, 'fold', 'folds')}`}
        />
        <ol className="cx-rail" aria-label="Mastery tiers">
          {TIER_RAIL.map((tier) => {
            const reached = RANK[mastery.tier] >= RANK[tier]
            return (
              <li key={tier} className="cx-rail__step" data-reached={reached ? 'true' : 'false'}>
                <span className="cx-rail__chit" aria-hidden>
                  {reached ? <Icon name="check" size={13} /> : null}
                </span>
                <span className="cx-rail__name">{MASTERY_LABEL[tier]}</span>
                <span className="pp-sr-only">{reached ? ' reached' : ' not yet reached'}</span>
              </li>
            )
          })}
        </ol>
        <p className="cx-note">{MASTERY_NOTE[mastery.tier]}</p>
      </section>

      {/* ── the record ─────────────────────────────────────────────────── */}
      {seen && (
        <section className="cx-block" aria-labelledby={`rec-${species.id}`}>
          <h3 className="pp-label cx-block__label" id={`rec-${species.id}`}>
            The record
          </h3>
          <dl className="cx-record">
            <div>
              <dt>Folded</dt>
              <dd className="pp-num">{folds}×</dd>
            </div>
            <div>
              <dt>Best fold</dt>
              <dd className="pp-num">{best > 0 ? `${Math.round(best * 100)}%` : '—'}</dd>
            </div>
            <div>
              <dt>On your planet</dt>
              <dd className="pp-num">{kami.length}</dd>
            </div>
            <div>
              <dt>Gold leaf</dt>
              <dd className="pp-num">{golden}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* ── the writing ────────────────────────────────────────────────── */}
      <section className="cx-block" aria-labelledby={`w-${species.id}`}>
        <h3 className="pp-label cx-block__label" id={`w-${species.id}`}>
          The entry
        </h3>

        {seen ? (
          <>
            <p className="cx-prose cx-prose--lead">{entry.fact}</p>
            <p className="cx-hab">
              <Icon name="leaf" size="sm" /> {entry.habitat}
            </p>
          </>
        ) : (
          <SealedPage
            title="Unwritten"
            body={`Fold ${species.name.toLowerCase()} once and this page writes itself.`}
          />
        )}

        {entry.factAdept ? (
          <div className="cx-page">
            <h4 className="cx-page__head">A closer look</h4>
            <p className="cx-prose">{entry.factAdept}</p>
          </div>
        ) : (
          <SealedPage
            title="A closer look"
            body={
              nextTier === 'adept'
                ? `${toNext} more ${plural(toNext, 'fold', 'folds')} and there is more to know about this one.`
                : 'Opens at Adept — three folds in.'
            }
          />
        )}

        {entry.foldLore ? (
          <div className="cx-page">
            <h4 className="cx-page__head">Where the fold comes from</h4>
            <p className="cx-prose">{entry.foldLore}</p>
          </div>
        ) : (
          <SealedPage
            title="Where the fold comes from"
            body={
              nextTier === 'master'
                ? `${toNext} more ${plural(toNext, 'fold', 'folds')} and the fold will tell you its own history.`
                : 'At Master, the fold tells you where it came from.'
            }
          />
        )}
      </section>

      {/* ── what you do next ───────────────────────────────────────────── */}
      <div className="cx-detail__act">
        {foldable ? (
          <Button variant="beni" size="lg" block icon="fold" onClick={fold} cue="ui.confirm">
            {seen ? 'Fold it again' : 'Fold this'}
          </Button>
        ) : (
          <Paper tone={2} edge="torn" elevation={0} radius="lg" seed={`lock-${species.id}`} className="cx-lock">
            <p className="cx-lock__head">
              <Icon name="lock" size="sm" /> <span>Not yet</span>
            </p>
            <p className="cx-lock__why">{unlock?.reason}</p>
            {unlock?.progress && (
              <Meter
                value={unlock.progress.have}
                max={unlock.progress.need}
                accent="matcha"
                size="sm"
                caption={`${unlock.progress.have} of ${unlock.progress.need}`}
                ariaLabel={`${unlock.progress.have} of ${unlock.progress.need}`}
              />
            )}
            {unlock?.cost && (
              <div className="cx-lock__buy">
                <Button
                  variant="gold-leaf"
                  size="md"
                  block
                  icon="goldleaf"
                  disabled={!unlock.affordable}
                  onClick={openWithGoldLeaf}
                  cue="ui.confirm"
                >
                  Open it with {unlock.cost.goldLeaf} Gold Leaf
                </Button>
                <p className="cx-lock__purse">
                  {unlock.affordable
                    ? 'Or keep folding — it opens that way too.'
                    : `You have ${goldLeaf}. Gold Leaf comes from folding as well.`}
                </p>
              </div>
            )}
          </Paper>
        )}
        {foldable && (
          <p className="cx-detail__paper">
            On <strong>{activeWashi.replace(/-/g, ' ')}</strong> — change the paper in Papers.
          </p>
        )}
      </div>
    </article>
  )
}

/** A page still folded shut. An invitation, never a wall — and never a price. */
function SealedPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="cx-sealed" role="note">
      <h4 className="cx-sealed__head">
        <span className="cx-sealed__seal" aria-hidden>
          <Icon name="fold" size={14} />
        </span>
        {title}
      </h4>
      <p className="cx-sealed__body">{body}</p>
    </div>
  )
}

export default SpeciesDetail
