/**
 * PAPER PLANET — the ghost hand.
 *
 * A translucent fingertip that performs the current gesture on the paper, with
 * one calm line telling you where to put your finger and one telling you what to
 * do with it. It lies on top of the sheet, takes no input, and vanishes the
 * moment a real finger arrives.
 */

import { useEffect, useRef } from 'react'
import type { Vec2 } from '../../contracts'
import { Icon, Paper, useElementSize } from '../../ui'
import {
  COACH_TIMING,
  REST_PHASE,
  demoGeometry,
  ghostsAt,
  placeOf,
  type CoachAnchors,
  type CoachGeometry,
  type CoachLesson,
  type Ghost,
} from './coach'
import './coach.css'

export interface FoldCoachProps {
  /** The lesson to give, or null for a silent teacher. */
  lesson: CoachLesson | null
  /** The step's anchors as projected on screen, when the Studio can see them. */
  live: CoachAnchors | null
  /** The step's authored anchors, in material space — the fallback direction. */
  authored: CoachAnchors | null
  /** Whether the crease guide and its handle are drawn — the copy depends on it. */
  guides: boolean
  /** Draw the pose and stop. The hand must never loop under reduced motion. */
  reducedMotion: boolean
}

/** A path with a soft rest at each end, for the burnish route. */
function chevron(at: Vec2, u: Vec2, size: number, flip: number): string {
  const px = -u[0] * flip
  const py = -u[1] * flip
  const nx = -u[1]
  const ny = u[0]
  const tipx = at[0] - px * size * 0.1
  const tipy = at[1] - py * size * 0.1
  return `M${tipx + px * size + nx * size} ${tipy + py * size + ny * size}L${tipx} ${tipy}L${
    tipx + px * size - nx * size
  } ${tipy + py * size - ny * size}`
}

function arrowHead(at: Vec2, u: Vec2, size: number): string {
  const nx = -u[1]
  const ny = u[0]
  return `M${at[0]} ${at[1]}L${at[0] - u[0] * size + nx * size * 0.62} ${at[1] - u[1] * size + ny * size * 0.62}L${
    at[0] - u[0] * size - nx * size * 0.62
  } ${at[1] - u[1] * size - ny * size * 0.62}Z`
}

/** The route drawn under the hand: where this gesture goes. */
function Route({ move, g }: { move: CoachLesson['move']; g: CoachGeometry }) {
  const head = g.tip * 0.86
  const line = `M${g.a[0]} ${g.a[1]}L${g.b[0]} ${g.b[1]}`
  const back: Vec2 = [-g.unit[0], -g.unit[1]]

  switch (move) {
    /* A press and a tap go nowhere. The ring is the whole story. */
    case 'press':
    case 'tap':
      return <circle className="pp-coach__route" cx={g.mid[0]} cy={g.mid[1]} r={g.tip * 2.3} fill="none" />

    /* Two fingers turning: the dial they turn on. */
    case 'twist':
      return <circle className="pp-coach__route" cx={g.mid[0]} cy={g.mid[1]} r={g.span / 2} fill="none" />

    /* Two fingers on one line, closing or opening. */
    case 'squeeze':
    case 'spread': {
      const near: Vec2 = [g.mid[0] - g.unit[0] * g.span * 0.16, g.mid[1] - g.unit[1] * g.span * 0.16]
      const far: Vec2 = [g.mid[0] + g.unit[0] * g.span * 0.16, g.mid[1] + g.unit[1] * g.span * 0.16]
      return (
        <>
          <path className="pp-coach__route" d={line} fill="none" />
          <path
            className="pp-coach__arrow"
            d={
              move === 'squeeze'
                ? `${arrowHead(near, g.unit, head)}${arrowHead(far, back, head)}`
                : `${arrowHead(g.a, back, head)}${arrowHead(g.b, g.unit, head)}`
            }
          />
        </>
      )
    }

    /* Back and forth: a chevron resting at each end of the stroke. */
    case 'stroke':
      return (
        <>
          <path className="pp-coach__route" d={line} fill="none" />
          <path
            className="pp-coach__tick"
            d={`${chevron(g.a, g.unit, head * 0.6, -1)}${chevron(g.b, g.unit, head * 0.6, 1)}`}
            fill="none"
          />
        </>
      )

    default:
      return (
        <>
          <path className="pp-coach__route" d={line} fill="none" />
          <path className="pp-coach__arrow" d={arrowHead(g.b, g.unit, head)} />
        </>
      )
  }
}

/** One fingertip: a contact ring, a cast shadow, and the pad itself. */
function GhostTip({ r, index, refs }: { r: number; index: number; refs: GhostRefs }) {
  return (
    <g
      className="pp-coach__ghost"
      ref={(el) => {
        refs.root[index] = el
      }}
    >
      <circle
        className="pp-coach__contact"
        r={r * 1.9}
        fill="none"
        ref={(el) => {
          refs.contact[index] = el
        }}
      />
      <circle
        className="pp-coach__pulse"
        r={r}
        fill="none"
        ref={(el) => {
          refs.pulse[index] = el
        }}
      />
      <ellipse className="pp-coach__cast" cx={1.6} cy={2.6} rx={r * 0.84} ry={r} />
      <ellipse className="pp-coach__pad" rx={r * 0.84} ry={r} />
      <ellipse className="pp-coach__nail" cy={-r * 0.3} rx={r * 0.42} ry={r * 0.48} />
    </g>
  )
}

interface GhostRefs {
  root: (SVGGElement | null)[]
  contact: (SVGCircleElement | null)[]
  pulse: (SVGCircleElement | null)[]
}

export default function FoldCoach({ lesson, live, authored, guides, reducedMotion }: FoldCoachProps) {
  const [hostRef, size] = useElementSize<HTMLDivElement>(!!lesson)
  const refs = useRef<GhostRefs>({ root: [], contact: [], pulse: [] })
  const rafRef = useRef(0)

  const move = lesson?.move ?? 'sweep'
  const fingers = lesson?.fingers ?? 1
  const g = lesson ? demoGeometry(live, authored, size, move) : null

  /* The hand is animated by mutating the SVG, not by re-rendering React sixty
     times a second. It demonstrates a few times and then rests — a teacher
     showing you, not a looping GIF. */
  useEffect(() => {
    if (!g || !lesson) return
    const apply = (phase: number): void => {
      const ghosts: Ghost[] = ghostsAt(move, fingers, g, phase)
      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i]
        const root = refs.current.root[i]
        if (!root) continue
        root.setAttribute(
          'transform',
          `translate(${ghost.pos[0].toFixed(2)} ${ghost.pos[1].toFixed(2)}) rotate(${ghost.angle.toFixed(1)})`,
        )
        root.setAttribute('opacity', ghost.alpha.toFixed(3))
        const contact = refs.current.contact[i]
        if (contact) {
          contact.setAttribute('r', (g.tip * (2.4 - ghost.press * 0.62)).toFixed(2))
          contact.setAttribute('opacity', (0.14 + ghost.press * 0.34).toFixed(3))
        }
        const pulse = refs.current.pulse[i]
        if (pulse) {
          pulse.setAttribute('r', (g.tip * (1 + ghost.pulse * 2.1)).toFixed(2))
          pulse.setAttribute('opacity', (ghost.pulse > 0 ? 0.5 * (1 - ghost.pulse) : 0).toFixed(3))
        }
      }
    }

    if (reducedMotion) {
      apply(REST_PHASE)
      return
    }

    const t0 = performance.now()
    const span = COACH_TIMING.cycle * COACH_TIMING.cycles
    const tick = (now: number): void => {
      const elapsed = now - t0
      if (elapsed >= span) {
        apply(REST_PHASE)
        return
      }
      apply((elapsed % COACH_TIMING.cycle) / COACH_TIMING.cycle)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // The geometry object is rebuilt each render; its numbers are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, move, fingers, reducedMotion, g?.a[0], g?.a[1], g?.b[0], g?.b[1], g?.tip])

  return (
    <div className="pp-coach" ref={hostRef} data-open={String(!!lesson)} data-move={move} aria-hidden={!lesson}>
      {lesson && g && (
        <>
          <svg
            className="pp-coach__ink"
            viewBox={`0 0 ${size.w} ${size.h}`}
            width={size.w}
            height={size.h}
            aria-hidden="true"
          >
            <Route move={move} g={g} />
            {Array.from({ length: fingers }, (_, i) => (
              <GhostTip key={i} index={i} r={g.tip} refs={refs.current} />
            ))}
          </svg>

          <div className="pp-coach__note-wrap">
            <Paper
              className="pp-coach__note"
              elevation={2}
              edge="deckle"
              tone={0}
              radius="md"
              seed={`coach-${lesson.topic}`}
              role="status"
            >
              <span className="pp-coach__mark" aria-hidden="true">
                <Icon
                  name={fingers === 2 ? 'pinch' : move === 'tap' || move === 'tap-then' ? 'tap' : 'hand'}
                  size="lg"
                />
              </span>
              <span className="pp-coach__lines">
                <span className="pp-coach__place">{placeOf(lesson, guides)}</span>
                <span className="pp-coach__act">{lesson.act}</span>
              </span>
            </Paper>
          </div>
        </>
      )}
    </div>
  )
}
