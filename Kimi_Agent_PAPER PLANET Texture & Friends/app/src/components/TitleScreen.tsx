import { getAnimal } from '../game/animals'
import { startBgm } from '../game/audio'
import OrigamiAnimal from './OrigamiAnimal'
import PushButton from './PushButton'

const LETTER_COLORS = ['#F28482', '#FFCE80', '#84A59D', '#B497E7', '#F2994A', '#7FB3D5']

function LogoWord({ word, offset = 0, size }: { word: string; offset?: number; size: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {word.split('').map((ch, i) => (
        <span
          key={i}
          className="font-display"
          style={{
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1,
            color: LETTER_COLORS[(i + offset) % LETTER_COLORS.length],
            WebkitTextStroke: '3px var(--ink)',
            paintOrder: 'stroke fill',
            textShadow: '4px 5px 0 rgba(86,62,121,0.22)',
            transform: `rotate(${(i % 2 ? 1 : -1) * (3 + ((i * 7) % 4))}deg) translateY(${(i % 3) * 4}px)`,
            display: 'inline-block',
            animation: `float-slow ${3 + (i % 4) * 0.6}s ease-in-out ${i * 0.15}s infinite`,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}

export default function TitleScreen({
  hasFriends,
  onPlay,
  onPlanet,
}: {
  hasFriends: boolean
  onPlay: () => void
  onPlanet: () => void
}) {
  const floaters = [
    { id: 'crane', x: '6%', y: '14%', size: 86, dur: 8, cls: 'anim-fly' },
    { id: 'butterfly', x: '78%', y: '10%', size: 64, dur: 6.5, cls: 'anim-flutter' },
    { id: 'frog', x: '80%', y: '58%', size: 78, dur: 7.5, cls: 'anim-drift' },
    { id: 'whale', x: '2%', y: '62%', size: 104, dur: 9, cls: 'anim-drift' },
  ]
  return (
    <div
      className="screen paper-grain vignette flex flex-col"
      style={{ background: 'linear-gradient(180deg,#AED9E0 0%,#F7EDE2 55%,#F5CAC3 100%)' }}
    >
      {/* drifting friends */}
      {floaters.map((f, i) => (
        <div
          key={f.id}
          className={f.cls}
          style={
            {
              position: 'absolute',
              left: f.x,
              top: f.y,
              ['--dur' as string]: `${f.dur}s`,
              ['--rot' as string]: `${i % 2 ? 8 : -10}deg`,
              opacity: 0.95,
            } as React.CSSProperties
          }
        >
          <OrigamiAnimal animal={getAnimal(f.id)} size={f.size} />
        </div>
      ))}

      {/* stars */}
      {[
        [12, 30],
        [88, 34],
        [30, 8],
        [64, 52],
        [45, 20],
      ].map(([x, y], i) => (
        <svg key={i} viewBox="0 0 20 20" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 18, animation: `twinkle ${2 + i * 0.5}s ease-in-out ${i * 0.4}s infinite` }}>
          <polygon points="10,0 13,7 20,10 13,13 10,20 7,13 0,10 7,7" fill="#FFCE80" />
        </svg>
      ))}

      <div className="flex flex-1 flex-col items-center justify-center gap-2" style={{ minHeight: 0, zIndex: 2 }}>
        <div
          className="font-display"
          style={{
            color: 'var(--ink)',
            fontSize: 'clamp(1rem, 3.4vw, 1.3rem)',
            letterSpacing: '0.35em',
            background: 'var(--sticker)',
            border: '3px solid var(--ink)',
            borderRadius: 999,
            padding: '0.2em 1.2em 0.2em 1.5em',
            boxShadow: '4px 4px 0 var(--ink)',
            transform: 'rotate(-2deg)',
            marginBottom: '1.2rem',
          }}
        >
          FOLD · PLAY · COLLECT
        </div>
        <LogoWord word="PAPER" size="clamp(3.6rem, 15vw, 7rem)" />
        <LogoWord word="PLANET" offset={3} size="clamp(3.6rem, 15vw, 7rem)" />
        <p
          className="mt-4 text-center"
          style={{ color: 'var(--ink-soft)', fontWeight: 800, fontSize: 'clamp(0.95rem, 3.4vw, 1.15rem)', maxWidth: 420 }}
        >
          Fold paper animals with your finger and watch them come alive on your very own planet.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <PushButton
            variant="sage"
            style={{ fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', padding: '0.7em 2.2em' }}
            onClick={() => {
              startBgm()
              onPlay()
            }}
          >
            ▶&nbsp; START FOLDING
          </PushButton>
          {hasFriends && (
            <PushButton
              variant="ghost"
              size="sm"
              onClick={() => {
                startBgm()
                onPlanet()
              }}
            >
              Visit my planet
            </PushButton>
          )}
        </div>
      </div>

      <div className="pb-5 text-center" style={{ color: 'var(--ink-soft)', fontWeight: 700, fontSize: '0.85rem', zIndex: 2 }}>
        Every friend is made of 100% recycled stardust & paper ✂
      </div>
    </div>
  )
}
