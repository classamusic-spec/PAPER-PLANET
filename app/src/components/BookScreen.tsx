import { ANIMALS } from '../game/animals'
import { sfx } from '../game/audio'
import OrigamiAnimal from './OrigamiAnimal'
import PushButton from './PushButton'

/* The collection book — every friend you have folded, golden variants & friendship hearts. */
export default function BookScreen({
  collection,
  gold,
  hearts,
  onBack,
}: {
  collection: string[]
  gold: string[]
  hearts: Record<string, number>
  onBack: () => void
}) {
  return (
    <div className="screen paper-grain flex flex-col" style={{ background: 'var(--coral-soft)' }}>
      <div className="flex items-center justify-between px-4 pt-4" style={{ zIndex: 2 }}>
        <PushButton variant="ghost" size="sm" onClick={onBack}>
          ← Planet
        </PushButton>
        <span className="font-display" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', color: 'var(--ink)' }}>
          My Folding Book
        </span>
        <div style={{ width: 76 }} />
      </div>
      <div className="mt-1 text-center" style={{ color: 'var(--ink-soft)', fontWeight: 800, zIndex: 2 }}>
        {collection.length} of {ANIMALS.length} friends discovered
      </div>

      <div
        className="mt-4 grid flex-1 content-start gap-5 overflow-y-auto px-6 pb-8"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', maxWidth: 640, margin: '0 auto', width: '100%' }}
      >
        {ANIMALS.map((a, i) => {
          const owned = collection.includes(a.id)
          const isGold = gold.includes(a.id)
          const love = Math.min(5, hearts[a.id] ?? 0)
          return (
            <div
              key={a.id}
              onClick={() => owned && sfx.chirp(a.chirp)}
              style={{
                background: 'var(--sticker)',
                border: isGold ? '3px solid #D9A621' : '3px solid var(--ink)',
                borderRadius: 18,
                boxShadow: isGold ? '4px 5px 0 #D9A621' : '4px 5px 0 var(--ink)',
                padding: '0.9rem 0.8rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                transform: `rotate(${i % 2 ? 1.2 : -1.2}deg)`,
                animation: `pop-in .5s var(--springy-big) ${i * 0.06}s both`,
                cursor: owned ? 'pointer' : 'default',
              }}
            >
              {owned ? (
                <div className="anim-bob" style={{ ['--dur' as string]: `${3 + i * 0.4}s` }}>
                  <OrigamiAnimal animal={a} size={84} gold={isGold} />
                </div>
              ) : (
                <div style={{ opacity: 0.55, filter: 'grayscale(0.4)' }}>
                  <OrigamiAnimal animal={a} size={84} silhouette />
                </div>
              )}
              <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>
                {owned ? a.name : '???'}
                {isGold && <span style={{ color: '#D9A621' }}> ✨</span>}
              </span>
              {owned && (
                <span style={{ fontSize: '0.8rem', letterSpacing: 2 }} title="friendship">
                  {Array.from({ length: 5 }, (_, h) => (
                    <span key={h} style={{ opacity: h < love ? 1 : 0.25 }}>
                      ❤️
                    </span>
                  ))}
                </span>
              )}
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.35 }}>
                {owned ? a.fact : 'Fold this paper to meet a new friend!'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
