/* PAPER PLANET — The Planet. A world you can look around, and reach into. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BiomeId } from '../../contracts'
import { BIOME_SCENERY, allBiomes, getBiome, getSpecies } from '../../content'
import {
  BOND_DAILY_CAP,
  SYS_KEY,
  actions,
  motionAllowed,
  readFlag,
  readFlagNumber,
  useAway,
  useDaily,
  useGame,
  useKamiList,
  useSettings,
  useToday,
  useWallet,
  type TendKind,
} from '../../systems'
import { audio, haptics } from '../../audio'
import { createGestureRecogniser } from '../../shell/gestures'
import { useNavigation } from '../../shell/Navigator'
import { Button, GoldLeafPill, Icon, IconButton, Paper, SheetsPill, useElementSize } from '../../ui'
import { ShareButton } from '../../features/share'
import KamiMark from '../codex/KamiMark'
import { PROP_ART, PROP_BAND } from './propArt'
import { BOX, TOUCH_MIN, hash01, placeKami, type Placed } from './layout'
import AwayNote from './AwayNote'
import TendCard from './TendCard'
import './planet.css'

/** How fast each depth band travels against a pan. Nearer moves more. */
const PARALLAX: Record<string, number> = { far: 0.22, mid: 0.55, near: 1 }

/** How long a reaction is allowed to stay on screen before it is cleared. */
const FLASH_MS = 2400

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/* ── the reaction vocabulary ────────────────────────────────────────────────
   Reactions are played straight onto the element rather than through React
   state, for two reasons. One: a tap must not re-render twelve Kami. Two: the
   button's `animation` slot is already spoken for by the species' idle, so a
   reaction has to live on the inner sheet — and a class there cannot be
   retriggered when you tap the same creature twice in a row. */

const BEAT: Record<'feed' | 'pet' | 'stir' | 'greet', Keyframe[]> = {
  /* Head down, take it, settle heavier than before. */
  feed: [
    { transform: 'translateY(0) scale(1,1)' },
    { transform: 'translateY(9%) scale(1.04,0.94)', offset: 0.22 },
    { transform: 'translateY(2%) scale(0.98,1.04)', offset: 0.5 },
    { transform: 'translateY(-3%) scale(1.03,1.01)', offset: 0.72 },
    { transform: 'translateY(0) scale(1,1)' },
  ],
  /* Lean into the hand. The old happy beat, kept. */
  pet: [
    { transform: 'scale(1) rotate(0deg)' },
    { transform: 'scale(1.15) rotate(-5deg)', offset: 0.3 },
    { transform: 'scale(0.97) rotate(4deg)', offset: 0.62 },
    { transform: 'scale(1) rotate(0deg)' },
  ],
  /* A flockmate looking over at the fuss. */
  stir: [
    { transform: 'scale(1) rotate(0deg)' },
    { transform: 'scale(1.06) rotate(-3.5deg)', offset: 0.38 },
    { transform: 'scale(1) rotate(0deg)' },
  ],
  /* Noticing that you are back. */
  greet: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-9%) scale(1.07)', offset: 0.34 },
    { transform: 'translateY(1%) scale(0.99)', offset: 0.68 },
    { transform: 'translateY(0) scale(1)' },
  ],
}

const BEAT_MS: Record<keyof typeof BEAT, number> = { feed: 1100, pet: 900, stir: 700, greet: 1000 }

export default function PlanetScreen() {
  const nav = useNavigation()
  const kami = useKamiList()
  const wallet = useWallet()
  const daily = useDaily()
  const settings = useSettings()
  const owned = useGame((s) => s.biomes)
  const seen = useGame((s) => s.seen)
  const today = useToday()
  const away = useAway()

  const [biome, setBiome] = useState<BiomeId>('meadow')
  const [open, setOpen] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ uid: string; note: string } | null>(null)
  const [morsel, setMorsel] = useState<{ uid: string; n: number } | null>(null)

  const [worldRef, world] = useElementSize<HTMLDivElement>()
  const navRef = useRef<HTMLElement>(null)
  const panRef = useRef(0)
  const bodies = useRef(new Map<string, HTMLElement>())
  const flashTimer = useRef<number | undefined>(undefined)

  const motion = motionAllowed(settings)
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

  /* ── placement ─────────────────────────────────────────────────────────── */

  /* Where the chrome actually starts, measured rather than assumed: the biome
     row grows as biomes open, and it sits higher on a tablet. The layout needs
     the real number or the biggest Kami stands with its feet behind a button. */
  const [chromeTop, setChromeTop] = useState(1)
  useLayoutEffect(() => {
    const nav = navRef.current
    const el = worldRef.current
    if (!nav || !el || world.h === 0) return
    const top = nav.getBoundingClientRect().top - el.getBoundingClientRect().top
    setChromeTop((prev) => (Math.abs(prev - top / world.h) < 0.002 ? prev : top / world.h))
  }, [world.h, world.w, biomes.length, worldRef])

  /* The Daily Fold lantern shares the top of the world with the note, so it
     waits underneath it — by the note's real height, which depends on how long
     you were away and how wide the screen is. */
  const [noteH, setNoteH] = useState(0)
  useLayoutEffect(() => {
    const note = document.querySelector('.pp-planet__away')
    setNoteH(note instanceof HTMLElement ? note.offsetHeight : 0)
  }, [away, world.w, world.h])

  const placed = useMemo<Placed[]>(
    () => placeKami(kami, biome, world.w, world.h, { water: scenery?.water === true, chromeTop }),
    [kami, biome, world.w, world.h, scenery, chromeTop],
  )
  const empty = placed.length === 0

  /* ── reactions ─────────────────────────────────────────────────────────── */

  const play = useCallback(
    (uid: string, beat: keyof typeof BEAT, delay = 0) => {
      const el = bodies.current.get(uid)
      if (!el || !motion || typeof el.animate !== 'function') return
      el.animate(BEAT[beat], {
        duration: BEAT_MS[beat],
        delay,
        easing: beat === 'stir' ? 'cubic-bezier(.2,.9,.25,1)' : 'cubic-bezier(.28,1.6,.4,1)',
        fill: 'none',
      })
    },
    [motion],
  )

  /** Everyone on screen looks up, nearest first. Used on return, and on hello. */
  const greetAll = useCallback(() => {
    for (const p of placed) play(p.kami.uid, 'greet', Math.round(p.x * 420))
  }, [placed, play])

  /* Coming back to a planet that has been alone is the one moment the whole
     field moves at once. It fires once per return, not on every re-render. */
  const greeted = useRef(false)
  useEffect(() => {
    if (away === null || placed.length === 0 || greeted.current) return
    greeted.current = true
    const id = window.setTimeout(greetAll, 420)
    return () => window.clearTimeout(id)
  }, [away, placed.length, greetAll])

  /* ── pan the world ─────────────────────────────────────────────────────── */

  /* The pan is written straight to a custom property. Bands and Kami read it in
     their own transforms, so dragging the world costs no React render at all —
     which is what keeps a dozen Kami at 60fps while the world moves. */
  const applyPan = useCallback((next: number) => {
    panRef.current = next
    worldRef.current?.style.setProperty('--pan', next.toFixed(4))
  }, [worldRef])

  useEffect(() => {
    const el = worldRef.current
    if (!el) return
    const rec = createGestureRecogniser(el, {
      onUpdate: (s) => {
        if (s.kind !== 'drag' && s.kind !== 'swipe') return
        applyPan(clamp(panRef.current + (s.stepX / (el.clientWidth || 1)) * -1.4, -1, 1))
        setOpen(null)
      },
    })

    /* A press on the ground puts the card away; a press on a Kami is that
       Kami's, and has to be given back to it. The recogniser captures the
       pointer on the world for every press so that a drag survives leaving the
       element — and a captured pointer retargets the compatibility click at the
       capture element, which silently swallowed every tap on a creature. This
       listener is registered here, right after the recogniser, so it is
       guaranteed to run second and can hand the pointer back. */
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Element | null
      if (target?.closest('.pp-planet__k, .pp-planet__tend')) {
        if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
        return
      }
      setOpen(null)
    }
    el.addEventListener('pointerdown', onDown)

    return () => {
      el.removeEventListener('pointerdown', onDown)
      rec.destroy()
    }
  }, [applyPan, worldRef])

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  /* ── tending ───────────────────────────────────────────────────────────── */

  const openPlaced = placed.find((p) => p.kami.uid === open) ?? null

  /** Today's remaining allowance, read the same way `tendKami` writes it. */
  const remainingToday = useMemo(() => {
    if (!openPlaced) return BOND_DAILY_CAP
    if (readFlag(seen, SYS_KEY.bondDay) !== today) return BOND_DAILY_CAP
    return Math.max(0, BOND_DAILY_CAP - readFlagNumber(seen, `${SYS_KEY.bondFed}/${openPlaced.kami.uid}`, 0))
  }, [openPlaced, seen, today])

  const tend = useCallback(
    (p: Placed, kind: TendKind) => {
      const out = actions.tend(p.kami.uid, kind)
      if (!out) return
      actions.dismissAway()

      if (out.gained > 0) {
        audio.play(kind === 'feed' ? 'alive.happy' : 'alive.nuzzle')
        haptics.fire(kind === 'feed' ? 'alive' : 'tick')
        play(p.kami.uid, kind)
        if (kind === 'feed') setMorsel((m) => ({ uid: p.kami.uid, n: (m?.n ?? 0) + 1 }))
      } else {
        audio.play('alive.breath')
        haptics.fire('tick')
      }

      /* The flock looks over. Nearest first, so the attention travels. */
      if (p.flock !== null) {
        for (const other of placed) {
          if (other.flock !== p.flock || other.kami.uid === p.kami.uid) continue
          play(other.kami.uid, 'stir', 120 + Math.round(Math.abs(other.x - p.x) * 900))
        }
      }

      window.clearTimeout(flashTimer.current)
      setFlash({ uid: p.kami.uid, note: out.note })
      flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS)
    },
    [placed, play],
  )

  /* ── where the tending card sits ───────────────────────────────────────── */
  const card = useMemo(() => {
    if (!openPlaced || world.w === 0) return null
    const boxPx = Math.max(openPlaced.scale * BOX * world.w, TOUCH_MIN)
    const cardW = Math.min(276, world.w - 24)
    const left = clamp(openPlaced.x * world.w, cardW / 2 + 12, world.w - cardW / 2 - 12)
    const below = openPlaced.y <= 0.45
    if (below) {
      const top = clamp(openPlaced.y * world.h + boxPx / 2 + 12, 72, Math.max(72, world.h - 300))
      return { below, style: { left: `${left}px`, top: `${top}px` } }
    }
    const bottom = clamp(world.h - (openPlaced.y * world.h - boxPx / 2 - 12), 156, Math.max(156, world.h - 220))
    return { below, style: { left: `${left}px`, bottom: `${bottom}px` } }
  }, [openPlaced, world.w, world.h])

  /* ── the note about being away ─────────────────────────────────────────── */
  const missedBy = useMemo(() => {
    if (kami.length === 0) return null
    const best = kami.reduce((a, b) => (b.bond > a.bond ? b : a))
    return best.nickname ?? getSpecies(best.speciesId)?.name ?? null
  }, [kami])

  return (
    <div
      className={'pp-planet' + (night ? ' is-night' : '')}
      data-biome={biome}
      style={{ ['--away-h' as string]: `${noteH}px` }}
    >
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
            style={{ ['--depth' as string]: PARALLAX[band] }}
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

        {/* Ground and pond travel with the Kami, in one layer the width of the
            world — a percentage translate is a percentage of the element, so
            panning them individually walked the pond out from under the fish. */}
        <div className="pp-planet__scene" aria-hidden="true">
          <div className="pp-planet__ground" />
          {scenery?.water && <div className="pp-planet__water" />}
        </div>

        {/* Kami */}
        <div className="pp-planet__kami">
          {placed.map((p) => {
            const name = p.kami.nickname ?? p.species.name
            const mates =
              p.with.length === 0
                ? ''
                : p.with.length <= 2
                  ? ` Together with the ${p.with.join(' and the ').toLowerCase()}.`
                  : ` Together with ${p.with.length} others.`
            return (
              <button
                key={p.kami.uid}
                type="button"
                className={
                  'pp-planet__k' +
                  (open === p.kami.uid ? ' is-open' : '') +
                  (p.flock !== null ? ' is-flocking' : '')
                }
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: `${p.scale * BOX * 100}%`,
                  ['--lean' as string]: `${p.lean.toFixed(2)}deg`,
                  ['--phase' as string]: `${p.phase.toFixed(2)}s`,
                }}
                data-idle={p.species.idle}
                data-uid={p.kami.uid}
                onClick={() => {
                  setOpen((cur) => (cur === p.kami.uid ? null : p.kami.uid))
                  audio.play('ui.open')
                }}
                aria-label={`${name}. ${Math.round(p.kami.bond)} of 100 bond.${mates} Tap to tend.`}
                aria-expanded={open === p.kami.uid}
              >
                <span
                  className="pp-planet__kbody"
                  ref={(el) => {
                    if (el) bodies.current.set(p.kami.uid, el)
                    else bodies.current.delete(p.kami.uid)
                  }}
                >
                  <KamiMark
                    art={p.species.art}
                    name={p.species.name}
                    size="100%"
                    mode="folded"
                    gold={p.kami.golden}
                    decorative
                  />
                </span>
                {morsel?.uid === p.kami.uid && (
                  <span key={morsel.n} className="pp-planet__morsel" aria-hidden="true">
                    <Icon name="leaf" size={16} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {openPlaced && card && (
          <TendCard
            placed={openPlaced}
            bond={openPlaced.kami.bond}
            remainingToday={remainingToday}
            style={card.style}
            below={card.below}
            flash={flash?.uid === openPlaced.kami.uid ? flash.note : null}
            onTend={(kind) => tend(openPlaced, kind)}
            onClose={() => {
              setOpen(null)
              audio.play('ui.close')
            }}
          />
        )}

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

      {away !== null && (
        <AwayNote
          away={away}
          name={missedBy}
          waiting={kami.length}
          onGreet={() => {
            actions.dismissAway()
            greetAll()
          }}
          onClose={() => actions.dismissAway()}
        />
      )}

      {/* The Daily Fold, waiting like a lit lantern. */}
      {!daily.done && daily.speciesId && (
        <button
          type="button"
          className={'pp-planet__lantern' + (away !== null ? ' is-lowered' : '')}
          onClick={() => nav.push('studio', { speciesId: daily.speciesId, mode: 'daily' })}
        >
          <Icon name="sparkle" size={16} />
          <span>
            <strong>Today&rsquo;s fold</strong>
            {getSpecies(daily.speciesId)?.name}
          </span>
        </button>
      )}

      <nav className="pp-planet__biomes" aria-label="Biomes" ref={navRef}>
        {biomes.map((b) => (
          <button
            key={b.id}
            type="button"
            className={'pp-planet__biome' + (b.id === biome ? ' is-here' : '')}
            onClick={() => {
              setBiome(b.id)
              setOpen(null)
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
