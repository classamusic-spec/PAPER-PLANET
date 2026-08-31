/* PAPER PLANET — The Planet. A world you can look around, made of cut paper. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BiomeId, KamiInstance, Species } from '../../contracts'
import type { Surface } from '../../content/types'
import { BIOME_SCENERY, allBiomes, getBiome, getMeta, getSpecies } from '../../content'
import { actions, useDaily, useGame, useKamiList, useSettings, useWallet } from '../../systems'
import { audio, haptics } from '../../audio'
import { createGestureRecogniser } from '../../shell/gestures'
import { useNavigation } from '../../shell/Navigator'
import { Button, GoldLeafPill, Icon, IconButton, Paper, SheetsPill, useToast } from '../../ui'
import { ShareButton } from '../../features/share'
import KamiMark from '../codex/KamiMark'
import { PROP_ART, PROP_BAND } from './propArt'
import './planet.css'

/**
 * Where each kind of creature stands, as a fraction of the world's height.
 *
 * Measured against what the world actually draws, not guessed: the ground
 * begins at 0.48, the pond occupies 0.61-0.70, and the biome tabs cover
 * everything below 0.825. So a walker belongs between the pond and the tabs —
 * standing in the water read as a bug rather than a swim, and standing below
 * them put half the collection behind a button.
 */
const BANDS: Record<string, [number, number]> = {
  air: [0.28, 0.44],
  perch: [0.48, 0.56],
  rock: [0.57, 0.63],
  water: [0.62, 0.68],
  ground: [0.72, 0.78],
}

/** Nothing may stand below this: the biome tabs start here. */
const FLOOR = 0.79

/** How fast each depth band travels against a pan. Nearer moves more. */
const PARALLAX: Record<string, number> = { far: 0.22, mid: 0.55, near: 1 }

/** Deterministic 0..1 from a string, so a world lays out the same every visit. */
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

interface Placed {
  kami: KamiInstance
  species: Species
  /** Normalised world position. */
  x: number
  y: number
  scale: number
  /** Kami of a species that flocks with a neighbour lean toward it. */
  lean: number
}

export default function PlanetScreen() {
  const nav = useNavigation()
  const kami = useKamiList()
  const wallet = useWallet()
  const daily = useDaily()
  const settings = useSettings()
  const owned = useGame((s) => s.biomes)
  const toast = useToast()

  const [biome, setBiome] = useState<BiomeId>('meadow')
  const [pan, setPan] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const panRef = useRef(0)

  const biomes = useMemo(() => allBiomes().filter((b) => owned.includes(b.id)), [owned])
  const current = getBiome(biome) ?? biomes[0]
  const scenery = BIOME_SCENERY[biome]

  /**
   * Night follows the theme the document actually resolved to — settings can say
   * `auto`, and the shell decides. Reading the attribute keeps the world and the
   * interface in the same hour instead of drifting apart.
   */
  const [night, setNight] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'night',
  )
  useEffect(() => {
    const root = document.documentElement
    const read = () => setNight(root.dataset.theme === 'night')
    read()
    const obs = new MutationObserver(read)
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [settings.theme])

  useEffect(() => {
    audio.setAmbience(night && current?.ambience === 'meadow' ? 'night' : current?.ambience ?? 'meadow', 2.5)
  }, [current, night])

  /* ── placement, from the species record rather than a hardcoded table ──── */
  const placed = useMemo<Placed[]>(() => {
    const here = kami.filter((k) => {
      const s = getSpecies(k.speciesId)
      return s ? s.biome === biome : false
    })

    /* Lay them out band by band rather than all at once.
       The old rule walked one index across the whole biome and wrapped it, so
       a fox and a rabbit could land on the same blade of grass while half the
       field stood empty. Spacing each band by how crowded that band is keeps
       them apart at any collection size, and keeps a walker out of the pond. */
    const bandOf = (k: KamiInstance): Surface => getMeta(k.speciesId)?.surface ?? 'ground'
    const order: Record<string, KamiInstance[]> = {}
    for (const k of here) (order[bandOf(k)] ??= []).push(k)

    return here.map((k) => {
      const species = getSpecies(k.speciesId)!
      const meta = getMeta(k.speciesId)
      const surface = bandOf(k)
      const jitterY = hash01(k.uid, 2)
      const jitterX = hash01(k.uid, 1)

      const siblings = order[surface] ?? [k]
      const slot = siblings.indexOf(k)
      const n = siblings.length
      // Evenly spaced across the field, with room to wander inside the slot.
      const spread = 0.84 / n
      const x = 0.08 + spread * (slot + 0.5) + (jitterX - 0.5) * spread * 0.4

      // Water dwellers sit low in the pond, fliers ride high, the rest walk.
      const band = BANDS[surface] ?? BANDS.ground
      const y = Math.min(FLOOR, band[0] + jitterY * (band[1] - band[0]))

      // A Kami whose species flocks with a neighbour here leans toward them.
      const flock = meta?.flock ?? []
      const friend = here.find((o) => o.uid !== k.uid && flock.includes(o.speciesId))
      return {
        kami: k,
        species,
        x,
        y,
        scale: (meta?.scale ?? 1) * (0.92 + (y - 0.5) * 0.34),
        lean: friend ? (hash01(friend.uid, 3) > 0.5 ? 6 : -6) : 0,
      }
    })
  }, [kami, biome])

  /* ── pan the world ────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = worldRef.current
    if (!el) return
    const rec = createGestureRecogniser(el, {
      onUpdate: (s) => {
        if (s.kind !== 'drag' && s.kind !== 'swipe') return
        panRef.current = Math.max(-1, Math.min(1, panRef.current + s.stepX / (el.clientWidth || 1) * -1.4))
        setPan(panRef.current)
      },
    })
    return () => rec.destroy()
  }, [])

  const tend = useCallback(
    (k: KamiInstance, species: Species) => {
      const out = actions.tend(k.uid, 'pet')
      audio.play(out && out.gained > 0 ? 'alive.nuzzle' : 'alive.breath')
      haptics.fire('tick')
      if (out && out.gained === 0) {
        toast.show({ title: `${k.nickname ?? species.name} has had plenty today.`, note: 'Come back tomorrow.' })
      }
      setSelected(k.uid)
      window.setTimeout(() => setSelected((cur) => (cur === k.uid ? null : cur)), 1800)
    },
    [toast],
  )

  const empty = placed.length === 0

  return (
    <div className={'pp-planet' + (night ? ' is-night' : '')} data-biome={biome}>
      {/* ── the world ──────────────────────────────────────────────────── */}
      <div
        ref={worldRef}
        className="pp-planet__world"
        style={
          {
            '--sky': current?.palette.sky,
            '--ground': current?.palette.ground,
            '--far': current?.palette.far,
            '--accent': current?.palette.accent,
          } as React.CSSProperties
        }
      >
        <div className="pp-planet__sky" aria-hidden="true" />

        {/* Scenery, in parallax bands */}
        {(['far', 'mid', 'near'] as const).map((band) => (
          <div
            key={band}
            className={`pp-planet__band pp-planet__band--${band}`}
            aria-hidden="true"
            style={{ transform: `translate3d(${pan * PARALLAX[band] * -26}%, 0, 0)` }}
          >
            {(scenery?.props ?? [])
              .filter((p) => (PROP_BAND[p] ?? 'mid') === band)
              .flatMap((p) => {
                const art = PROP_ART[p]
                if (!art) return []
                const n = band === 'far' ? 3 : band === 'mid' ? 6 : 9
                return Array.from({ length: n }, (_, i) => {
                  const seed = hash01(p + i, 7)
                  const size = band === 'far' ? 0.34 : band === 'mid' ? 0.19 : 0.12
                  return (
                    <svg
                      key={`${p}-${i}`}
                      className="pp-planet__prop"
                      viewBox={`0 0 ${art.w} ${art.h}`}
                      style={{
                        left: `${(i / n) * 108 + seed * 10 - 6}%`,
                        bottom: `${band === 'far' ? 42 + seed * 9 : band === 'mid' ? 38 + seed * 7 : 6 + seed * 26}%`,
                        width: `${size * 100}%`,
                      }}
                    >
                      {art.facets.map((f, fi) => (
                        <polygon key={fi} points={f.pts} className={`t-${f.tone}${f.soft ? ' is-soft' : ''}`} />
                      ))}
                    </svg>
                  )
                })
              })}
          </div>
        ))}

        <div className="pp-planet__ground" aria-hidden="true" />
        {scenery?.water && <div className="pp-planet__water" aria-hidden="true" />}

        {/* Kami */}
        <div
          className="pp-planet__kami"
          style={{ transform: `translate3d(${pan * -26}%, 0, 0)` }}
        >
          {placed.map((p) => (
            <button
              key={p.kami.uid}
              type="button"
              className={'pp-planet__k' + (selected === p.kami.uid ? ' is-happy' : '')}
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.scale * 17}%`,
                ['--lean' as string]: `${p.lean}deg`,
                ['--phase' as string]: `${hash01(p.kami.uid, 5) * 9}s`,
              }}
              data-idle={p.species.idle}
              onClick={() => tend(p.kami, p.species)}
              aria-label={`${p.kami.nickname ?? p.species.name}. Bond ${Math.round(p.kami.bond)} of 100. Tap to greet.`}
            >
              <KamiMark
                art={p.species.art}
                name={p.species.name}
                size="100%"
                mode="folded"
                gold={p.kami.golden}
                decorative
              />
            </button>
          ))}
        </div>

        {empty && (
          <div className="pp-planet__empty">
            <Icon name="crane" size={64} />
            <p>Nothing lives here yet.</p>
            <Button variant="beni" onClick={() => nav.push('select')}>
              Fold your first Kami
            </Button>
          </div>
        )}
      </div>

      {/* ── chrome ─────────────────────────────────────────────────────── */}
      <header className="pp-planet__hud">
        <div className="pp-planet__purse">
          <SheetsPill value={wallet.sheets} />
          <GoldLeafPill value={wallet.goldLeaf} />
        </div>
        <div className="pp-planet__hudacts">
          <ShareButton subject={{ kind: 'planet' }} label="Share your planet" variant="quiet" />
          <IconButton icon="settings" label="Settings" variant="quiet" onClick={() => nav.push('settings')} />
        </div>
      </header>

      {/* The Daily Fold, waiting like a lit lantern. */}
      {!daily.done && daily.speciesId && (
        <button
          type="button"
          className="pp-planet__lantern"
          onClick={() => nav.push('studio', { speciesId: daily.speciesId, mode: 'daily' })}
        >
          <Icon name="sparkle" size={16} />
          <span>
            <strong>Today&rsquo;s fold</strong>
            {getSpecies(daily.speciesId)?.name}
          </span>
        </button>
      )}

      <nav className="pp-planet__biomes" aria-label="Biomes">
        {biomes.map((b) => (
          <button
            key={b.id}
            type="button"
            className={'pp-planet__biome' + (b.id === biome ? ' is-here' : '')}
            onClick={() => {
              setBiome(b.id)
              audio.play('sheet.slide')
            }}
            aria-current={b.id === biome ? 'true' : undefined}
          >
            {b.name}
          </button>
        ))}
      </nav>

      <footer className="pp-planet__dock">
        <Paper elevation={3} edge="cut" tone={0} grain className="pp-planet__dockpaper">
          <div className="pp-planet__dockrow">
            <DockButton icon="codex" label="Codex" onClick={() => nav.push('codex')} />
            <DockButton icon="shop" label="Shop" onClick={() => nav.push('shop')} />
            <Button variant="beni" onClick={() => nav.push('select')}>
              <Icon name="fold" size={16} /> Fold
            </Button>
            <DockButton icon="leaf" label="Zen" onClick={() => nav.push('zen')} />
            <DockButton icon="crane" label="Title" onClick={() => nav.reset('title')} />
          </div>
        </Paper>
      </footer>
    </div>
  )
}

function DockButton({
  icon,
  label,
  onClick,
}: {
  icon: 'codex' | 'shop' | 'leaf' | 'crane'
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className="pp-planet__dockbtn" onClick={onClick}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  )
}
