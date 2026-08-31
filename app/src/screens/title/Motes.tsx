/* PAPER PLANET — drifting paper motes. A fixed, seeded field; never a swarm of timers. */

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { hashSeed, mulberry32 } from '../../ui'

export interface MotesProps {
  /** How many flecks. Twelve is plenty; the old title ran thirty. */
  count?: number
  /** Off = the flecks are still dust on the desk, but nothing moves. */
  animate?: boolean
  seed?: string
  className?: string
}

interface Mote {
  x: number
  y: number
  size: number
  dur: number
  delay: number
  rot: number
  dx: number
  dy: number
  opacity: number
  square: boolean
}

/**
 * Cut-paper flecks caught in the lamplight. They are laid out once from a seed,
 * so the field is identical on every render and every reload — the desk has
 * dust in the same places, the way a real desk does.
 */
export default function Motes({ count = 12, animate = true, seed = 'title-motes', className }: MotesProps) {
  const motes = useMemo<Mote[]>(() => {
    const rand = mulberry32(hashSeed(seed))
    const out: Mote[] = []
    for (let i = 0; i < count; i++) {
      out.push({
        x: 4 + rand() * 92,
        y: 4 + rand() * 90,
        size: 3 + rand() * 7,
        dur: 15 + rand() * 12,
        delay: -rand() * 18,
        rot: rand() * 360,
        dx: (rand() - 0.5) * 46,
        dy: -14 - rand() * 34,
        opacity: 0.16 + rand() * 0.24,
        square: rand() > 0.45,
      })
    }
    return out
  }, [count, seed])

  return (
    <div className={className ? `pp-motes ${className}` : 'pp-motes'} aria-hidden="true">
      {motes.map((m, i) => (
        <span
          key={i}
          className="pp-mote"
          data-shape={m.square ? 'square' : 'sliver'}
          style={
            {
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: `${m.size}px`,
              height: `${m.square ? m.size : m.size * 0.42}px`,
              opacity: m.opacity,
              '--mote-dur': `${m.dur}s`,
              '--mote-delay': `${m.delay}s`,
              '--mote-rot': `${m.rot}deg`,
              '--mote-dx': `${m.dx}px`,
              '--mote-dy': `${m.dy}px`,
              animationPlayState: animate ? undefined : 'paused',
              animationName: animate ? undefined : 'none',
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
