/* PAPER PLANET — choose a fold, and the paper to fold it from. */

import { useCallback, useMemo, useState } from 'react'
import type { BiomeId, Species, Washi } from '../../contracts'
import { allBiomes, allSpecies, allWashi, getSpecies, MASTERY_LABEL } from '../../content'
import {
  actions,
  evaluateUnlock,
  masteryFor,
  unlockContextFrom,
  useActiveWashi,
  useDaily,
  useGame,
} from '../../systems'
import { audio } from '../../audio'
import { useNavigation } from '../../shell/Navigator'
import { Button, Chip, Icon, IconButton, Paper, Sheet } from '../../ui'
import KamiMark from '../codex/KamiMark'
import WashiSwatch from '../codex/WashiSwatch'
import './select.css'

interface Row {
  species: Species
  folds: number
  tier: string
  locked: boolean
  reason: string
}

export default function SelectScreen() {
  const nav = useNavigation()
  const daily = useDaily()
  const activeWashi = useActiveWashi()
  const [washiOpen, setWashiOpen] = useState(false)
  const [biome, setBiome] = useState<BiomeId | 'all'>('all')

  const content = useGame((s) => s.content)
  const folds = useGame((s) => s.folds)
  const owned = useGame((s) => s.washi)
  const biomesOwned = useGame((s) => s.biomes)
  const entitlements = useGame((s) => s.entitlements)
  const goldLeaf = useGame((s) => s.goldLeaf)

  const rows = useMemo<Row[]>(() => {
    const nameFor = (id: string): string =>
      content.speciesById.get(id)?.name ?? content.biomeById.get(id as BiomeId)?.name ?? id
    const ctx = unlockContextFrom({ folds, biomes: biomesOwned, entitlements, goldLeaf }, nameFor)
    return allSpecies()
      .map((species) => {
        const n = folds[species.id] ?? 0
        const u = evaluateUnlock(species.id, species.unlock, ctx)
        return {
          species,
          folds: n,
          tier: MASTERY_LABEL[masteryFor(n)] ?? 'Novice',
          locked: !u.unlocked,
          reason: u.reason,
        }
      })
      // Foldable first — this screen is for choosing, not for browsing.
      .sort((a, b) => Number(a.locked) - Number(b.locked))
  }, [content, folds, biomesOwned, entitlements, goldLeaf])

  const shown = useMemo(
    () => (biome === 'all' ? rows : rows.filter((r) => r.species.biome === biome)),
    [rows, biome],
  )

  const myWashi = useMemo<Washi[]>(
    () => allWashi().filter((w) => owned.includes(w.id)),
    [owned],
  )
  const activeWashiRecord = myWashi.find((w) => w.id === activeWashi) ?? myWashi[0]

  const start = useCallback(
    (speciesId: string, mode: 'normal' | 'daily' = 'normal') => {
      audio.play('ui.confirm')
      nav.push('studio', { speciesId, mode })
    },
    [nav],
  )

  const todaysFold = daily.speciesId ? getSpecies(daily.speciesId) : undefined

  return (
    <div className="pp-select">
      <header className="pp-select__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <h1>What will you fold?</h1>
        <IconButton
          icon="fold"
          label="Choose your paper"
          variant="quiet"
          onClick={() => {
            setWashiOpen(true)
            audio.play('ui.open')
          }}
        />
      </header>

      <div className="pp-select__scroll">
        {/* The Daily Fold: a lit lantern, per the game design. */}
        {todaysFold && (
          <Paper elevation={2} edge="deckle" tone={0} tilt={-0.6} grain className="pp-select__daily">
            <div className="pp-select__daily-body">
              <div className="pp-select__daily-mark">
                <KamiMark art={todaysFold.art} name={todaysFold.name} size="100%" mode="folded" decorative />
              </div>
              <div className="pp-select__daily-text">
                <p className="pp-select__eyebrow">
                  <Icon name="sparkle" size={12} /> Today&rsquo;s fold
                </p>
                <h2>{todaysFold.name}</h2>
                <p className="pp-select__daily-note">
                  {daily.streak > 0
                    ? `${daily.streak} ${daily.streak === 1 ? 'day' : 'days'} in a row.`
                    : 'A new one waits each day.'}
                </p>
                <Button
                  variant={daily.done ? 'quiet' : 'beni'}
                  size="sm"
                  onClick={() => start(todaysFold.id, 'daily')}
                >
                  {daily.done ? 'Fold it again' : 'Fold it'}
                </Button>
              </div>
            </div>
          </Paper>
        )}

        {/* Your paper */}
        {activeWashiRecord && (
          <button
            type="button"
            className="pp-select__washi"
            onClick={() => {
              setWashiOpen(true)
              audio.play('ui.open')
            }}
          >
            <WashiSwatch washi={activeWashiRecord} size={44} decorative />
            <span>
              <span className="pp-select__eyebrow">Your paper</span>
              <span className="pp-select__washi-name">{activeWashiRecord.name}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        )}

        <div className="pp-select__filters" role="group" aria-label="Biomes">
          <Chip selected={biome === 'all'} onClick={() => setBiome('all')}>
            All
          </Chip>
          {allBiomes().map((b) => (
            <Chip key={b.id} selected={biome === b.id} onClick={() => setBiome(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>

        <ul className="pp-select__grid">
          {shown.map((row) => (
            <li key={row.species.id}>
              <Paper
                as="button"
                elevation={row.locked ? 0 : 2}
                edge={row.locked ? 'torn' : 'cut'}
                tone={row.locked ? 1 : 0}
                grain
                className="pp-select__card"
                onClick={() => (row.locked ? audio.play('ui.back') : start(row.species.id))}
                aria-disabled={row.locked || undefined}
                aria-label={
                  row.locked
                    ? `${row.species.name}. Locked. ${row.reason}`
                    : `Fold a ${row.species.name}. ${row.folds > 0 ? row.tier : 'Not folded yet'}.`
                }
              >
                <span className="pp-select__mark">
                  <KamiMark
                    art={row.species.art}
                    name={row.species.name}
                    size="100%"
                    mode={row.folds > 0 ? 'folded' : 'silhouette'}
                    decorative
                  />
                </span>
                <span className="pp-select__name">{row.species.name}</span>
                <span className="pp-select__state">
                  {row.locked ? (
                    <>
                      <Icon name="lock" size={11} /> {row.reason}
                    </>
                  ) : (
                    <>
                      {row.species.recipe.steps.length} steps
                      {row.folds > 0 ? ` · ${row.tier}` : ''}
                    </>
                  )}
                </span>
              </Paper>
            </li>
          ))}
        </ul>
      </div>

      <Sheet
        open={washiOpen}
        onClose={() => setWashiOpen(false)}
        title="Your papers"
        note="The paper you fold from changes nothing but how it looks."
      >
        <ul className="pp-select__washilist">
          {myWashi.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className={'pp-select__washirow' + (w.id === activeWashi ? ' is-active' : '')}
                onClick={() => {
                  actions.setActiveWashi(w.id)
                  audio.play('ui.confirm')
                  setWashiOpen(false)
                }}
                aria-pressed={w.id === activeWashi}
              >
                <WashiSwatch washi={w} size={52} decorative />
                <span className="pp-select__washimeta">
                  <span className="pp-select__washi-name">{w.name}</span>
                  <span className="pp-select__washi-note">{w.note}</span>
                </span>
                {w.id === activeWashi && <Icon name="check" size={18} />}
              </button>
            </li>
          ))}
        </ul>
        <div className="pp-select__washifoot">
          <Button variant="quiet" size="sm" onClick={() => { setWashiOpen(false); nav.push('shop') }}>
            More papers
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
