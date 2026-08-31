import { useEffect, useState } from 'react'
import { ANIMALS, getAnimal } from '../game/animals'
import { sfx, startCrickets, stopCrickets } from '../game/audio'
import OrigamiAnimal from './OrigamiAnimal'
import PushButton from './PushButton'

/* Where each friend lives on the diorama (percent of screen). ground = casts a shadow. */
const SLOTS: Record<string, { x: number; y: number; size: number; ground: boolean }> = {
  crane: { x: 8, y: 24, size: 100, ground: false },
  owl: { x: 80, y: 12, size: 84, ground: false },
  butterfly: { x: 58, y: 20, size: 82, ground: false },
  bat: { x: 22, y: 10, size: 78, ground: false },
  whale: { x: 50, y: 55, size: 132, ground: false },
  fish: { x: 68, y: 60, size: 58, ground: false },
  octopus: { x: 56, y: 62, size: 74, ground: false },
  dino: { x: 32, y: 54, size: 108, ground: true },
  fox: { x: 10, y: 62, size: 104, ground: true },
  penguin: { x: 88, y: 68, size: 88, ground: true },
  frog: { x: 40, y: 72, size: 88, ground: true },
  cat: { x: 20, y: 76, size: 94, ground: true },
  rabbit: { x: 62, y: 76, size: 84, ground: true },
  turtle: { x: 44, y: 82, size: 88, ground: true },
  pumpkin: { x: 8, y: 80, size: 88, ground: true },
  snail: { x: 90, y: 82, size: 78, ground: true },
  ladybug: { x: 30, y: 86, size: 52, ground: false },
  snowhare: { x: 74, y: 84, size: 82, ground: true },
}

const DAY_MS = 75000

function Cloud({ top, dur, delay, scale }: { top: string; dur: number; delay: number; scale: number }) {
  return (
    <svg
      viewBox="0 0 120 60"
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: 130 * scale,
        animation: `clouddrift ${dur}s linear ${delay}s infinite`,
        opacity: 0.95,
      }}
    >
      <polygon points="10,45 30,20 60,12 95,22 110,45" fill="#FFFDF7" stroke="#EFE0CD" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="30,45 60,12 95,45" fill="#F7EDE2" />
    </svg>
  )
}

function Sun() {
  return (
    <div style={{ position: 'absolute', top: '4%', left: '6%', width: 110, height: 110 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', animation: 'sunspin 40s linear infinite' }}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          const x1 = 50 + Math.cos(a) * 34
          const y1 = 50 + Math.sin(a) * 34
          const x2 = 50 + Math.cos(a + 0.18) * 46
          const y2 = 50 + Math.sin(a + 0.18) * 46
          const x3 = 50 + Math.cos(a - 0.18) * 46
          const y3 = 50 + Math.sin(a - 0.18) * 46
          return <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="#F6A54F" />
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 20,
          borderRadius: '50%',
          background: 'var(--sun)',
          border: '4px solid var(--ink)',
          animation: 'float-slow 5s ease-in-out infinite',
        }}
      />
    </div>
  )
}

function Moon() {
  return (
    <div style={{ position: 'absolute', top: '5%', right: '10%', width: 84, height: 84, animation: 'float-slow 7s ease-in-out infinite' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%' }}>
        <circle cx="50" cy="50" r="38" fill="#FFE9A8" stroke="var(--ink)" strokeWidth="4" />
        <circle cx="64" cy="42" r="30" fill="#2E2754" />
        <circle cx="38" cy="60" r="4" fill="#F0D489" />
        <circle cx="30" cy="44" r="2.5" fill="#F0D489" />
      </svg>
    </div>
  )
}

function PaperTree({ left, bottom, scale = 1 }: { left: string; bottom: string; scale?: number }) {
  return (
    <svg viewBox="0 0 60 90" style={{ position: 'absolute', left, bottom, width: 52 * scale }}>
      <polygon points="26,90 34,90 32,62 28,62" fill="#B44F4F" />
      <polygon points="30,6 8,44 52,44" fill="#5F8A80" stroke="#FFFDF7" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="30,26 4,68 56,68" fill="#84A59D" stroke="#FFFDF7" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

/* A little paper berry that drops onto a friend */
function Berry() {
  return (
    <svg viewBox="0 0 40 44" style={{ position: 'absolute', left: '50%', top: -10, width: 30, marginLeft: -15, animation: 'berry-drop 1s ease-in forwards', zIndex: 7 }}>
      <polygon points="20,10 32,16 34,30 20,40 6,30 8,16" fill="#F28482" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="20,10 32,16 20,22" fill="#F7A8A0" />
      <polygon points="14,10 20,2 26,10" fill="#84A59D" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export default function PlanetScreen({
  collection,
  gold,
  onFeed,
  onFold,
  onBook,
  onHome,
}: {
  collection: string[]
  gold: string[]
  onFeed: (id: string) => void
  onFold: () => void
  onBook: () => void
  onHome: () => void
}) {
  const [night, setNight] = useState(false)
  const [trickId, setTrickId] = useState<string | null>(null)
  const [bubble, setBubble] = useState<{ id: string; kind: 'name' | 'heart' } | null>(null)
  const [feedMode, setFeedMode] = useState(false)
  const [berryFor, setBerryFor] = useState<string | null>(null)

  /* slow auto day/night cycle */
  useEffect(() => {
    const t = setInterval(() => setNight((n) => !n), DAY_MS)
    return () => clearInterval(t)
  }, [])

  /* crickets come out at night */
  useEffect(() => {
    if (night) startCrickets()
    else stopCrickets()
    return () => stopCrickets()
  }, [night])

  const poke = (id: string) => {
    const a = getAnimal(id)
    if (feedMode) {
      onFeed(id)
      sfx.munch()
      navigator.vibrate?.(20)
      setBerryFor(id)
      setBubble({ id, kind: 'heart' })
      setTrickId(id)
      setTimeout(() => setBerryFor((b) => (b === id ? null : b)), 1000)
      setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), 1300)
      setTimeout(() => setTrickId((t) => (t === id ? null : t)), 900)
      return
    }
    sfx.chirp(a.chirp)
    navigator.vibrate?.(25)
    setTrickId(id)
    setBubble({ id, kind: 'name' })
    setTimeout(() => setTrickId((t) => (t === id ? null : t)), 900)
    setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), 1400)
  }

  const dimFilter = night ? 'brightness(0.62) saturate(0.85)' : 'none'
  const hasPond = collection.some((id) => id === 'whale' || id === 'fish' || id === 'octopus')

  return (
    <div className="screen vignette" style={{ background: 'linear-gradient(180deg, #9FD3DE 0%, #C8E6E7 42%, #F7EDE2 100%)' }}>
      <div className="paper-grain absolute inset-0" />
      {/* night sky crossfade */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #2E2754 0%, #4A3A6B 45%, #7A639B 100%)',
          opacity: night ? 1 : 0,
          transition: 'opacity 2.5s ease',
          pointerEvents: 'none',
        }}
      />
      {/* stars */}
      {night &&
        [
          [12, 18],
          [30, 8],
          [52, 14],
          [70, 30],
          [86, 20],
          [40, 32],
          [64, 6],
          [22, 38],
        ].map(([x, y], i) => (
          <svg key={i} viewBox="0 0 20 20" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 14, animation: `twinkle ${1.6 + i * 0.4}s ease-in-out ${i * 0.3}s infinite` }}>
            <polygon points="10,0 13,7 20,10 13,13 10,20 7,13 0,10 7,7" fill="#FFE9A8" />
          </svg>
        ))}
      {/* fireflies */}
      {night &&
        [
          [18, 58],
          [44, 50],
          [66, 66],
          [82, 54],
          [32, 70],
          [74, 44],
        ].map(([x, y], i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#FFE9A8',
              boxShadow: '0 0 10px 4px rgba(255,233,168,0.55)',
              ['--fx' as string]: `${(i % 2 ? -1 : 1) * 26}px`,
              ['--fy' as string]: `${-22 - i * 6}px`,
              animation: `firefly ${4 + i * 0.9}s ease-in-out ${i * 0.7}s infinite`,
            }}
          />
        ))}

      <div style={{ opacity: night ? 0 : 1, transition: 'opacity 2.5s ease' }}>
        <Sun />
      </div>
      <div style={{ opacity: night ? 1 : 0, transition: 'opacity 2.5s ease' }}>
        <Moon />
      </div>
      <div style={{ opacity: night ? 0.35 : 1, transition: 'opacity 2.5s ease' }}>
        <Cloud top="9%" dur={52} delay={-12} scale={1} />
        <Cloud top="20%" dur={70} delay={-40} scale={0.7} />
        <Cloud top="4%" dur={90} delay={-64} scale={1.25} />
      </div>

      {/* the planet */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '-118vw',
          width: '170vw',
          maxWidth: 900,
          aspectRatio: '1',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'var(--sage)',
          border: '6px solid var(--sticker)',
          boxShadow: '0 -14px 40px rgba(86,62,121,0.18)',
          filter: dimFilter,
          transition: 'filter 2.5s ease',
        }}
      >
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <polygon points="20,18 50,10 44,34" fill="#93B4AC" opacity="0.9" />
          <polygon points="62,12 84,24 58,34" fill="#6E968B" opacity="0.9" />
          <polygon points="30,40 52,34 44,52" fill="#6E968B" opacity="0.7" />
        </svg>
      </div>
      {hasPond && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '15%',
            width: '46vw',
            maxWidth: 330,
            height: 56,
            borderRadius: '50%',
            background: 'var(--sky)',
            border: '5px solid var(--sticker)',
            boxShadow: 'inset 0 6px 0 rgba(255,255,255,0.5)',
            filter: dimFilter,
            transition: 'filter 2.5s ease',
          }}
        />
      )}
      <div style={{ filter: dimFilter, transition: 'filter 2.5s ease' }}>
        <PaperTree left="10%" bottom="24%" />
        <PaperTree left="80%" bottom="30%" scale={0.75} />
      </div>

      {/* friends */}
      {collection.map((id, i) => {
        const a = getAnimal(id)
        const slot = SLOTS[id] ?? { x: 40, y: 60, size: 100, ground: true }
        const tricking = trickId === id
        const isGold = gold.includes(id)
        // the bat naps upside-down by day and hunts by night
        const idleClass = id === 'bat' ? (night ? 'anim-fly' : 'anim-hang') : `anim-${a.idle}`
        return (
          <button
            key={id}
            onClick={() => poke(id)}
            aria-label={a.name}
            style={{
              position: 'absolute',
              left: `calc(${slot.x}% - ${slot.size / 2}px)`,
              top: `${slot.y}%`,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              zIndex: tricking ? 5 : 2,
              animation: `pop-in .6s var(--springy-big) ${i * 0.12}s both`,
              filter: dimFilter,
              transition: 'filter 2.5s ease',
            }}
          >
            {bubble?.id === id && (
              <span
                className="font-display"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -14,
                  transform: 'translateX(-50%)',
                  background: 'var(--sticker)',
                  border: '2.5px solid var(--ink)',
                  borderRadius: 12,
                  padding: '0 0.6em',
                  fontSize: '1rem',
                  whiteSpace: 'nowrap',
                  animation: 'rise-fade 1.4s ease-out both',
                  zIndex: 6,
                }}
              >
                {bubble.kind === 'heart' ? '❤ yum!' : `${a.name}!`}
              </span>
            )}
            {berryFor === id && <Berry />}
            {isGold && (
              <span style={{ position: 'absolute', right: -6, top: -8, fontSize: 15, animation: `twinkle 1.6s ease-in-out ${i * 0.3}s infinite`, zIndex: 6 }}>✨</span>
            )}
            <div
              className={tricking ? 'anim-trick' : idleClass}
              style={{ ['--dur' as string]: `${(a.idle === 'fly' ? 9 : 3) + i * 0.7}s`, position: 'relative' }}
            >
              {slot.ground && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -4,
                    left: '16%',
                    right: '16%',
                    height: 11,
                    borderRadius: '50%',
                    background: night ? 'rgba(10,8,26,0.4)' : 'rgba(60,50,40,0.22)',
                    filter: 'blur(4px)',
                    transition: 'background 2.5s ease',
                  }}
                />
              )}
              <OrigamiAnimal animal={a} size={slot.size} gold={isGold} />
            </div>
          </button>
        )
      })}

      {/* header */}
      <div className="flex items-center justify-between px-4 pt-4" style={{ position: 'relative', zIndex: 10 }}>
        <PushButton variant="ghost" size="sm" onClick={onHome} ariaLabel="Home">
          ★ Title
        </PushButton>
        <div className="flex gap-3">
          <PushButton variant="ghost" size="sm" quiet onClick={() => { setNight((n) => !n); sfx.sparkle() }} ariaLabel="Toggle day and night">
            {night ? '☀️' : '🌙'}
          </PushButton>
          <PushButton variant={feedMode ? 'sun' : 'ghost'} size="sm" onClick={() => setFeedMode((f) => !f)} ariaLabel="Feed friends">
            🍓
          </PushButton>
          <PushButton variant="sky" size="sm" onClick={onBook}>
            📖
          </PushButton>
          <PushButton variant="sun" size="sm" onClick={onFold}>
            ✂ Fold
          </PushButton>
        </div>
      </div>

      {feedMode && (
        <div
          className="font-display"
          style={{
            position: 'absolute',
            top: 74,
            left: '50%',
            transform: 'translateX(-50%) rotate(-1.5deg)',
            background: 'var(--sticker)',
            border: '3px solid var(--ink)',
            borderRadius: 14,
            boxShadow: '4px 4px 0 var(--ink)',
            padding: '0.2em 0.9em',
            fontSize: '1.05rem',
            zIndex: 10,
            animation: 'banner-in .4s var(--springy) both',
          }}
        >
          Snack time! Tap a friend 🍓
        </div>
      )}

      {collection.length === 0 && (
        <div
          className="font-display"
          style={{
            position: 'absolute',
            left: '50%',
            top: '42%',
            transform: 'translate(-50%,-50%) rotate(-2deg)',
            background: 'var(--sticker)',
            border: '3px solid var(--ink)',
            borderRadius: 18,
            boxShadow: '5px 5px 0 var(--ink)',
            padding: '0.6em 1.1em',
            fontSize: 'clamp(1.2rem,4.5vw,1.7rem)',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          Your planet is quiet…
          <br />
          <span style={{ color: 'var(--coral)' }}>Fold your first friend!</span>
        </div>
      )}

      {/* collection count */}
      <div
        className="font-display"
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          color: night ? '#2E2754' : 'var(--sticker)',
          fontSize: '1.15rem',
          textShadow: night ? 'none' : '0 2px 0 rgba(86,62,121,.35)',
          transition: 'color 2.5s ease',
          zIndex: 10,
        }}
      >
        {collection.length} / {ANIMALS.length} friends {gold.length > 0 && `· ✨${gold.length} golden`}
      </div>
    </div>
  )
}
