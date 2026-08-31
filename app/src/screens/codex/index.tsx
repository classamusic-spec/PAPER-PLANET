/* PAPER PLANET — The Codex. The collection, and something worth reading. */

import { useCallback, useMemo, useState } from 'react'
import type { BiomeId, Species } from '../../contracts'
import { allBiomes, allSpecies, MASTERY_LABEL } from '../../content'
import { useBiomes, useCollection, useGame } from '../../systems'
import { masteryFor, evaluateUnlock, unlockContextFrom } from '../../systems'
import { audio } from '../../audio'
import { useNavigation } from '../../shell/Navigator'
import { Icon, IconButton, Paper, Sheet, Tabs, plural } from '../../ui'
import { ShareButton } from '../../features/share'
import CodexProgress from './Progress'
import SpeciesCard, { type CodexRow } from './SpeciesCard'
import SpeciesDetail from './SpeciesDetail'
import { useMedia } from './useMedia'
import './codex.css'

type Filter = 'all' | BiomeId

export default function CodexScreen() {
  const nav = useNavigation()
  const summary = useCollection()
  const opened = useBiomes()
  const wide = useMedia('(min-width: 900px)')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string | null>(null)

  /* Everything a card needs, computed once here — cards hold no state. */
  const content = useGame((s) => s.content)
  const folds = useGame((s) => s.folds)
  const kami = useGame((s) => s.kami)
  const biomesOwned = useGame((s) => s.biomes)
  const entitlements = useGame((s) => s.entitlements)
  const goldLeaf = useGame((s) => s.goldLeaf)

  const rows = useMemo<CodexRow[]>(() => {
    const nameFor = (id: string): string =>
      content.speciesById.get(id)?.name ?? content.biomeById.get(id as BiomeId)?.name ?? id
    const ctx = unlockContextFrom({ folds, biomes: biomesOwned, entitlements, goldLeaf }, nameFor)
    return allSpecies().map((species) => {
      const n = folds[species.id] ?? 0
      const mine = kami.filter((k) => k.speciesId === species.id)
      const unlock = evaluateUnlock(species.id, species.unlock, ctx)
      return {
        species,
        folds: n,
        tierLabel: MASTERY_LABEL[masteryFor(n)] ?? 'Novice',
        locked: !unlock.unlocked,
        reason: unlock.reason,
        golden: mine.some((k) => k.golden),
        instances: mine.length,
        best: mine.reduce((a, k) => Math.max(a, k.quality), 0),
      }
    })
  }, [content, folds, kami, biomesOwned, entitlements, goldLeaf])

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.species.biome === filter)),
    [rows, filter],
  )

  const biomes = useMemo(() => allBiomes(), [])
  const current: Species | undefined = useMemo(
    () => rows.find((r) => r.species.id === selected)?.species,
    [rows, selected],
  )

  const onSelect = useCallback((id: string) => {
    audio.play('ui.tap')
    setSelected(id)
  }, [])

  const onFold = useCallback(
    (speciesId: string) => {
      audio.play('ui.confirm')
      nav.push('studio', { speciesId })
    },
    [nav],
  )

  const onFoldAlong = useCallback(
    (speciesId: string) => {
      audio.play('sheet.slide')
      nav.push('foldalong', { speciesId })
    },
    [nav],
  )

  return (
    <div className="pp-codex">
      <header className="pp-codex__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <div className="pp-codex__title">
          <h1>The Codex</h1>
          <p>
            {summary.collected} of {summary.total} folds · {summary.kami}{' '}
            {plural(summary.kami, 'Kami', 'Kami')} on your planet
          </p>
        </div>
        <div className="pp-codex__spacer" />
      </header>

      <div className="pp-codex__progress">
        <CodexProgress summary={summary} biomes={biomes} opened={opened} filter={filter} />
      </div>

      <div className="pp-codex__filters">
        <Tabs
          label="Biomes"
          bare
          items={[
            { id: 'all', label: 'All' },
            ...biomes.map((b) => ({ id: b.id, label: b.name })),
          ]}
          value={filter}
          onChange={(id) => {
            setFilter(id as Filter)
            audio.play('ui.tap')
          }}
        />
      </div>

      <div className={'pp-codex__body' + (wide && current ? ' is-split' : '')}>
        <ul className="pp-codex__grid">
          {shown.map((row) => (
            <SpeciesCard
              key={row.species.id}
              row={row}
              selected={row.species.id === selected}
              onSelect={onSelect}
            />
          ))}
        </ul>

        {wide && current && (
          <aside className="pp-codex__aside">
            <Paper elevation={2} edge="cut" tone={0} grain>
              <div className="pps-detail-bar">
                <ShareButton
                  subject={{ kind: 'species', speciesId: current.id }}
                  label={`Share ${current.name}`}
                  variant="quiet"
                />
              </div>
              <SpeciesDetail species={current} onFold={onFold} onFoldAlong={onFoldAlong} />
            </Paper>
          </aside>
        )}
      </div>

      {!wide && (
        <Sheet
          open={!!current}
          onClose={() => setSelected(null)}
          title={current?.name}
          note={current?.binomial}
        >
          {current && (
            <>
              <div className="pps-detail-bar">
                <ShareButton
                  subject={{ kind: 'species', speciesId: current.id }}
                  label={`Share ${current.name}`}
                  variant="quiet"
                />
              </div>
              <SpeciesDetail
                species={current}
                compactHeading
                onFold={onFold}
                onFoldAlong={onFoldAlong}
                onLeave={() => setSelected(null)}
              />
            </>
          )}
        </Sheet>
      )}

      {shown.length === 0 && (
        <p className="pp-codex__empty">
          <Icon name="leaf" /> Nothing here yet. Fold something and it will appear.
        </p>
      )}
    </div>
  )
}
