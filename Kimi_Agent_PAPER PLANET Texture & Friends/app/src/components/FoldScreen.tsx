import { useCallback, useEffect, useRef, useState } from 'react'
import type { Animal } from '../game/animals'
import { sfx } from '../game/audio'
import { GRAIN_URI } from '../game/grain'
import OrigamiAnimal from './OrigamiAnimal'
import PushButton from './PushButton'
import Confetti from './Confetti'

type Phase = 'folding' | 'revealing' | 'alive'

export default function FoldScreen({
  animal,
  sparkle,
  onDone,
  onBack,
  onAlive,
}: {
  animal: Animal
  sparkle: boolean
  onDone: () => void
  onBack: () => void
  onAlive: (sparkle: boolean) => void
}) {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0) // fold progress 0..1
  const [rub, setRub] = useState(0) // crease rub progress 0..1
  const [phase, setPhase] = useState<Phase>('folding')
  const [dragging, setDragging] = useState(false)

  const arenaRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const lastRubSound = useRef(0)
  const raf = useRef(0)
  const prog = useRef(0)
  prog.current = progress
  const rubRef = useRef(0)
  rubRef.current = rub

  const fold = animal.folds[step]
  const totalSteps = animal.folds.length
  const isCrease = fold.kind === 'crease'

  const animateTo = useCallback((target: number, done?: () => void) => {
    cancelAnimationFrame(raf.current)
    const tick = () => {
      const cur = prog.current
      const next = cur + (target - cur) * 0.22
      if (Math.abs(target - next) < 0.01) {
        setProgress(target)
        done?.()
        return
      }
      setProgress(next)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [])

  const advance = useCallback(() => {
    if (step + 1 >= totalSteps) {
      setPhase('revealing')
      setTimeout(() => {
        setPhase('alive')
        if (sparkle) sfx.goldFanfare()
        else sfx.fanfare()
        navigator.vibrate?.([40, 60, 80])
        onAlive(sparkle)
      }, 650)
    } else {
      setTimeout(() => {
        setStep((s) => s + 1)
        setProgress(0)
        setRub(0)
      }, 260)
    }
  }, [step, totalSteps, sparkle, onAlive])

  const completeFold = useCallback(() => {
    sfx.foldDone()
    navigator.vibrate?.(30)
    advance()
  }, [advance])

  const toLocal = (e: React.PointerEvent) => {
    const r = arenaRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, size: r.width }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== 'folding') return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toLocal(e)
    drag.current = { x: p.x, y: p.y }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || phase !== 'folding') return
    const p = toLocal(e)
    const scale = p.size / 400
    const vx = p.x - drag.current.x
    const vy = p.y - drag.current.y

    if (isCrease) {
      // rub along the crease: accumulate absolute travel along the axis
      const [ax1, ay1, ax2, ay2] = fold.axis
      const dx = (ax2 - ax1) * scale
      const dy = (ay2 - ay1) * scale
      const len = Math.hypot(dx, dy)
      const travel = Math.abs((vx * dx + vy * dy) / len) // px along crease
      const needed = len * 3.4
      const next = Math.min(1, rubRef.current + travel / needed)
      setRub(next)
      // velocity-driven friction sound, throttled
      const nowMs = performance.now()
      if (travel > 3 && nowMs - lastRubSound.current > 55) {
        lastRubSound.current = nowMs
        sfx.rubScratch(Math.min(1, travel / 22))
        navigator.vibrate?.(4)
      }
      drag.current = { x: p.x, y: p.y }
      if (next >= 1) {
        drag.current = null
        setDragging(false)
        sfx.creaseDone()
        navigator.vibrate?.(35)
        advance()
      }
      return
    }

    // fold / pinch: progress = projection along the arrow
    const [ax1, ay1, ax2, ay2] = fold.arrow
    const dx = (ax2 - ax1) * scale
    const dy = (ay2 - ay1) * scale
    const len = Math.hypot(dx, dy)
    const proj = (vx * dx + vy * dy) / (len * len)
    const next = Math.min(1, Math.max(0, proj * 1.15))
    if (Math.abs(next - prog.current) > 0.004) {
      setProgress(next)
      if (next > 0.15 && Math.random() < 0.1) sfx.whoosh(next)
    }
  }

  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    if (phase !== 'folding' || isCrease) return
    if (prog.current > 0.72) {
      animateTo(1, completeFold)
    } else {
      animateTo(0)
      sfx.back()
    }
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  /* fold geometry */
  const [lx1, ly1, lx2, ly2] = fold.axis
  const ux = lx2 - lx1
  const uy = ly2 - ly1
  const ulen = Math.hypot(ux, uy)
  const angle = progress * -176
  const flapFill = progress > 0.5 ? animal.paperBack : animal.paper
  const shade = 1 - Math.sin(progress * Math.PI) * 0.22
  const sheetColor = sparkle ? '#F5C04A' : animal.paper

  const [hx1, hy1, hx2, hy2] = fold.arrow
  const hintDx = hx2 - hx1
  const hintDy = hy2 - hy1
  const turn = fold.turn ?? 0

  return (
    <div className="screen paper-grain vignette flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* header */}
      <div className="flex items-center justify-between px-4 pt-4" style={{ zIndex: 2 }}>
        <PushButton variant="ghost" size="sm" onClick={onBack} ariaLabel="Back">
          ← Back
        </PushButton>
        <div className="flex items-center gap-2">
          {animal.folds.map((f, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: f.kind === 'crease' ? 7 : 4,
                transform: `rotate(${i % 2 ? 12 : -8}deg) scale(${i < step ? 1 : i === step ? 1.25 : 0.9})`,
                background: i < step ? 'var(--sage)' : i === step ? (sparkle ? '#F5C04A' : animal.paper) : 'var(--paper-deep)',
                border: '2.5px solid var(--ink)',
                transition: 'all .3s var(--springy)',
              }}
            />
          ))}
        </div>
        <div style={{ width: 76 }} />
      </div>

      {sparkle && phase === 'folding' && (
        <div className="mt-2 text-center" style={{ zIndex: 2 }}>
          <span
            className="font-display sparkle-tag"
            style={{
              fontSize: '1rem',
              color: '#8a6410',
              background: 'linear-gradient(90deg,#FFE9A8,#F5C04A,#FFE9A8)',
              backgroundSize: '200% 100%',
              border: '2.5px solid var(--ink)',
              borderRadius: 999,
              padding: '0.1em 1em',
            }}
          >
            ✨ SPARKLE PAPER — golden friend inside!
          </span>
        </div>
      )}

      {phase !== 'alive' ? (
        <>
          {/* instruction */}
          <div className="mt-3 text-center" style={{ zIndex: 2 }}>
            <span
              className="font-display inline-block"
              style={{
                fontSize: 'clamp(1.3rem, 4.5vw, 1.9rem)',
                background: 'var(--sticker)',
                border: '3px solid var(--ink)',
                borderRadius: 16,
                padding: '0.15em 0.8em',
                boxShadow: '4px 4px 0 var(--ink)',
                transform: 'rotate(-1.5deg)',
              }}
            >
              {phase === 'revealing' ? 'Something is wiggling…' : fold.instruction}
            </span>
          </div>

          {/* folding arena */}
          <div className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
            <div
              ref={arenaRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                width: 'min(88vw, 52vh)',
                aspectRatio: '1',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                perspective: '1100px',
                position: 'relative',
              }}
            >
              {/* table shadow */}
              <div
                style={{
                  position: 'absolute',
                  left: '16%',
                  right: '16%',
                  bottom: '2%',
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(86,62,121,0.14)',
                  filter: 'blur(6px)',
                }}
              />
              <svg
                viewBox="0 0 400 400"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  overflow: 'visible',
                  transformStyle: 'preserve-3d',
                  transform: `rotate(${turn}deg)`,
                  transition: 'transform .5s var(--springy)',
                  animation: phase === 'revealing' ? 'wiggle .18s ease-in-out infinite' : undefined,
                }}
              >
                {/* the sheet */}
                <path
                  d={fold.paper}
                  fill={sheetColor}
                  stroke={sparkle ? '#FFE9A8' : 'var(--sticker)'}
                  strokeWidth={7}
                  strokeLinejoin="round"
                />
                <path d={fold.paper} fill="url(#sheetShade)" opacity={0.25} />
                <path
                  d={fold.paper}
                  fill="url(#sheetGrain)"
                  opacity={0.5}
                  style={{ mixBlendMode: 'multiply' }}
                  pointerEvents="none"
                />
                {sparkle && (
                  <path d={fold.paper} fill="url(#sheetShimmer)" opacity={0.85} pointerEvents="none" />
                )}
                {/* crease hint / progress */}
                {phase === 'folding' && !isCrease && (
                  <line
                    x1={lx1}
                    y1={ly1}
                    x2={lx2}
                    y2={ly2}
                    stroke="var(--ink)"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    className="fold-line"
                    opacity={0.75}
                    pointerEvents="none"
                  />
                )}
                {isCrease && (
                  <>
                    <line
                      x1={lx1}
                      y1={ly1}
                      x2={lx2}
                      y2={ly2}
                      stroke="var(--ink)"
                      strokeWidth={6}
                      strokeLinecap="round"
                      opacity={0.3}
                      pointerEvents="none"
                    />
                    {/* the crease fills with gold as you rub */}
                    <line
                      x1={lx1}
                      y1={ly1}
                      x2={lx2}
                      y2={ly2}
                      stroke="#F5C04A"
                      strokeWidth={6}
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray="100"
                      strokeDashoffset={100 * (1 - rub)}
                      pointerEvents="none"
                    />
                  </>
                )}
                {/* the flap — lift shadow grows with the fold angle */}
                {!isCrease && fold.flap && (
                  <g
                    style={{
                      transformBox: 'view-box',
                      transformOrigin: `${(lx1 + lx2) / 2}px ${(ly1 + ly2) / 2}px`,
                      transform: `rotate3d(${ux / ulen}, ${uy / ulen}, 0, ${angle}deg)`,
                      filter: `brightness(${shade}) drop-shadow(0 ${4 + progress * 22}px ${6 + progress * 14}px rgba(86,62,121,${0.12 + progress * 0.25}))`,
                    }}
                  >
                    <path
                      d={fold.flap}
                      fill={sparkle && progress <= 0.5 ? '#F5C04A' : flapFill}
                      stroke={progress > 0.5 ? 'var(--paper-deep)' : sparkle ? '#FFE9A8' : 'var(--sticker)'}
                      strokeWidth={7}
                      strokeLinejoin="round"
                    />
                    <path
                      d={fold.flap}
                      fill="url(#sheetGrain)"
                      opacity={0.5}
                      style={{ mixBlendMode: 'multiply' }}
                      pointerEvents="none"
                    />
                  </g>
                )}
                {/* drag hints */}
                {phase === 'folding' && progress < 0.08 && rub < 0.05 && !isCrease && fold.kind === 'fold' && (
                  <g
                    style={{
                      ['--hx' as string]: `${hintDx * 0.55}px`,
                      ['--hy' as string]: `${hintDy * 0.55}px`,
                      animation: 'hintslide 1.4s ease-in-out infinite',
                    }}
                  >
                    <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke="var(--ink)" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
                    <polygon
                      points={`${hx2},${hy2} ${hx2 - hintDy * 0.16 - hintDx * 0.12},${hy2 + hintDx * 0.16 - hintDy * 0.12} ${hx2 + hintDy * 0.16 - hintDx * 0.12},${hy2 - hintDx * 0.16 - hintDy * 0.12}`}
                      fill="var(--ink)"
                      opacity={0.55}
                    />
                    <circle cx={hx1} cy={hy1} r={13} fill="var(--sun)" stroke="var(--ink)" strokeWidth={3.5} />
                  </g>
                )}
                {phase === 'folding' && progress < 0.08 && fold.kind === 'pinch' && (
                  <g>
                    {/* target star */}
                    <g style={{ animation: 'twinkle 1.2s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
                      <polygon
                        points={`${hx2},${hy2 - 16} ${hx2 + 5},${hy2 - 5} ${hx2 + 16},${hy2} ${hx2 + 5},${hy2 + 5} ${hx2},${hy2 + 16} ${hx2 - 5},${hy2 + 5} ${hx2 - 16},${hy2} ${hx2 - 5},${hy2 - 5}`}
                        fill="var(--sun)"
                        stroke="var(--ink)"
                        strokeWidth={3}
                        strokeLinejoin="round"
                      />
                    </g>
                    {/* pulsing corner handle */}
                    <circle cx={hx1} cy={hy1} r={16} fill="var(--coral)" stroke="var(--ink)" strokeWidth={3.5} />
                    <circle
                      cx={hx1}
                      cy={hy1}
                      r={16}
                      fill="none"
                      stroke="var(--coral)"
                      strokeWidth={4}
                      style={{ animation: 'pulse-ring 1.2s ease-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}
                    />
                  </g>
                )}
                {phase === 'folding' && isCrease && rub < 0.6 && (
                  <g
                    style={{
                      ['--hx' as string]: `${hintDx}px`,
                      ['--hy' as string]: `${hintDy}px`,
                      animation: 'hintslide 1s ease-in-out infinite',
                    }}
                  >
                    <polygon
                      points={`${hx2},${hy2} ${hx2 - hintDy * 0.14 - hintDx * 0.14},${hy2 + hintDx * 0.14 - hintDy * 0.14} ${hx2 + hintDy * 0.14 - hintDx * 0.14},${hy2 - hintDx * 0.14 - hintDy * 0.14}`}
                      fill="var(--ink)"
                      opacity={0.6}
                    />
                    <polygon
                      points={`${hx1},${hy1} ${hx1 - hintDy * 0.14 + hintDx * 0.14},${hy1 + hintDx * 0.14 + hintDy * 0.14} ${hx1 + hintDy * 0.14 + hintDx * 0.14},${hy1 - hintDx * 0.14 + hintDy * 0.14}`}
                      fill="var(--ink)"
                      opacity={0.6}
                    />
                    <circle cx={(hx1 + hx2) / 2} cy={(hy1 + hy2) / 2} r={13} fill="var(--sun)" stroke="var(--ink)" strokeWidth={3.5} />
                  </g>
                )}
                <defs>
                  <linearGradient id="sheetShade" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
                    <stop offset="1" stopColor="#563e79" stopOpacity="0.35" />
                  </linearGradient>
                  <linearGradient id="sheetShimmer" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#FFF3C4" stopOpacity="0.55">
                      <animate attributeName="offset" values="0.1;0.9;0.1" dur="2.2s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                  <pattern id="sheetGrain" patternUnits="userSpaceOnUse" width="140" height="140">
                    <image href={GRAIN_URI} width="140" height="140" />
                  </pattern>
                </defs>
              </svg>
              {/* sparkle motes around sparkle paper */}
              {sparkle && phase === 'folding' && (
                <>
                  {[
                    [12, 18],
                    [84, 30],
                    [20, 78],
                    [78, 84],
                  ].map(([x, y], i) => (
                    <span
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}%`,
                        fontSize: 18,
                        animation: `twinkle ${1.2 + i * 0.3}s ease-in-out ${i * 0.25}s infinite`,
                        pointerEvents: 'none',
                      }}
                    >
                      ✨
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="pb-6 text-center" style={{ color: 'var(--ink-soft)', fontWeight: 700, zIndex: 2 }}>
            Folding a {animal.name} · Step {Math.min(step + 1, totalSteps)} of {totalSteps}
          </div>
        </>
      ) : (
        /* ---- IT'S ALIVE ---- */
        <div className="relative flex flex-1 flex-col items-center justify-center" style={{ minHeight: 0 }}>
          <Confetti />
          <div style={{ animation: 'pop-in .7s var(--springy-big) both' }}>
            <OrigamiAnimal animal={animal} size="min(46vw, 34vh)" className="anim-bob" gold={sparkle} />
          </div>
          <div
            className="font-display mt-5 text-center"
            style={{
              fontSize: 'clamp(2rem, 8vw, 3.2rem)',
              color: sparkle ? '#B8860B' : 'var(--ink)',
              animation: 'banner-in .6s var(--springy) .25s both',
              textShadow: sparkle ? '3px 3px 0 #FFE9A8' : '3px 3px 0 var(--coral-soft)',
            }}
          >
            {sparkle ? '✨ GOLDEN!' : 'It’s alive! 🎉'}
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 'clamp(1.2rem, 4.5vw, 1.6rem)',
              color: 'var(--ink-soft)',
              animation: 'banner-in .6s var(--springy) .4s both',
            }}
          >
            {sparkle ? `A golden ${animal.name} joins your planet!` : `You folded a ${animal.name}!`}
          </div>
          <div
            className="mt-7 flex gap-4"
            style={{ animation: 'banner-in .6s var(--springy) .55s both', zIndex: 2 }}
          >
            <PushButton variant="ghost" onClick={onBack}>
              Fold another
            </PushButton>
            <PushButton variant="sage" onClick={onDone}>
              To the planet →
            </PushButton>
          </div>
        </div>
      )}
    </div>
  )
}
