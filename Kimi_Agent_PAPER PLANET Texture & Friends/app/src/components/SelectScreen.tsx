import { ANIMALS } from '../game/animals'
import OrigamiAnimal from './OrigamiAnimal'
import PushButton from './PushButton'

/* Pick a sheet of paper to fold. */
export default function SelectScreen({
  collection,
  gold,
  onPick,
  onBack,
}: {
  collection: string[]
  gold: string[]
  onPick: (id: string) => void
  onBack: () => void
}) {
  return (
    <div className="screen paper-grain flex flex-col" style={{ background: 'var(--paper)' }}>
      <div className="flex items-center justify-between px-4 pt-4" style={{ zIndex: 2 }}>
        <PushButton variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </PushButton>
        <span
          className="font-display"
          style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', color: 'var(--ink)', transform: 'rotate(-1.5deg)' }}
        >
          Pick your paper!
        </span>
        <div style={{ width: 76 }} />
      </div>

      <div
        className="mt-6 grid flex-1 content-start gap-5 overflow-y-auto px-6 pb-8"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', maxWidth: 620, margin: '0 auto', width: '100%' }}
      >
        {ANIMALS.map((a, i) => {
          const owned = collection.includes(a.id)
          const isGold = gold.includes(a.id)
          return (
            <button
              key={a.id}
              onClick={() => onPick(a.id)}
              className="anim-wiggle"
              style={{
                ['--dur' as string]: `${2.4 + (i % 3) * 0.5}s`,
                position: 'relative',
                background: 'var(--sticker)',
                border: isGold ? '3px solid #D9A621' : '3px solid var(--ink)',
                borderRadius: 20,
                boxShadow: isGold ? '5px 6px 0 #D9A621' : '5px 6px 0 var(--ink)',
                padding: '1rem 0.6rem 0.8rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`,
                transition: 'transform .15s var(--springy)',
                animation: `pop-in .5s var(--springy-big) ${i * 0.07}s both`,
              }}
            >
              {/* seasonal ribbon */}
              {a.seasonal && (
                <span
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: -10,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: 'var(--sticker)',
                    background: a.seasonal === 'autumn' ? '#D97F35' : '#6FA8C9',
                    borderRadius: 999,
                    padding: '0.15em 0.6em',
                    transform: 'rotate(-8deg)',
                    zIndex: 2,
                  }}
                >
                  {a.seasonal === 'autumn' ? '🍂 SEASONAL' : '❄ SEASONAL'}
                </span>
              )}
              {isGold && (
                <span style={{ position: 'absolute', top: -10, right: -8, fontSize: '1.1rem', zIndex: 2 }}>✨</span>
              )}
              {/* folded-corner paper swatch */}
              <div style={{ position: 'relative', width: 86, height: 86 }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, ${a.paper} 0%, ${a.paper} 72%, ${a.paperDark} 72.5%, ${a.paperDark} 100%)`,
                    border: '3px solid var(--ink)',
                    borderRadius: 8,
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <OrigamiAnimal animal={a} size={66} silhouette={!owned} gold={owned && isGold} />
                </div>
              </div>
              <span className="font-display" style={{ fontSize: '1.15rem', color: 'var(--ink)' }}>
                {owned ? a.name : '???'}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--sticker)',
                  background: isGold ? '#D9A621' : owned ? 'var(--sage)' : 'var(--coral)',
                  borderRadius: 999,
                  padding: '0.1em 0.7em',
                }}
              >
                {isGold ? 'GOLDEN ✨' : owned ? 'FOLD AGAIN' : 'NEW FRIEND'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
