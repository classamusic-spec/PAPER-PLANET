import { useMemo } from 'react'

const COLORS = ['#F28482', '#FFCE80', '#84A59D', '#AED9E0', '#B497E7', '#F5CAC3', '#FFFDF7']

/* A burst of paper scraps that flutter down and fade. */
export default function Confetti({ count = 42 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const left = 8 + Math.random() * 84
        const size = 7 + Math.random() * 10
        const tri = Math.random() > 0.5
        return {
          id: i,
          left,
          size,
          tri,
          top: -10 + Math.random() * 30,
          color: COLORS[i % COLORS.length],
          cx: (Math.random() - 0.5) * 260,
          cy: 320 + Math.random() * 420,
          cr: 300 + Math.random() * 720,
          dur: 1.7 + Math.random() * 1.6,
          delay: Math.random() * 0.45,
        }
      }),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.tri ? 0 : p.size * 0.7,
            background: p.tri ? 'transparent' : p.color,
            borderLeft: p.tri ? `${p.size / 2}px solid transparent` : undefined,
            borderRight: p.tri ? `${p.size / 2}px solid transparent` : undefined,
            borderBottom: p.tri ? `${p.size}px solid ${p.color}` : undefined,
            borderRadius: p.tri ? 0 : 2,
            ['--cx' as string]: `${p.cx}px`,
            ['--cy' as string]: `${p.cy}px`,
            ['--cr' as string]: `${p.cr}deg`,
            animation: `confetti-fall ${p.dur}s cubic-bezier(.2,.6,.5,1) ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
