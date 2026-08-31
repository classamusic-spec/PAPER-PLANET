// PAPER PLANET — <Reveal> / <Stagger>: sheets landing on the desk, in order.

import { Children, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ElementType, ReactElement, ReactNode } from 'react'
import type { CSSVars } from './hooks'

export interface RevealProps {
  children?: ReactNode
  /** Milliseconds before this sheet lands. */
  delay?: number
  /** Distance it travels, px. Negative comes down from above. */
  y?: number
  /** Rotation it resolves from, degrees. */
  rotate?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
}

/**
 * One entrance: up from the bottom edge with a small rotation that resolves to
 * the element's own tilt, on `--ease-settle`. Reduced motion shortens it to
 * `--t-quick` (see paper.css) — it never disappears, because a sheet appearing
 * from nowhere is worse than a sheet that moves a little.
 */
export function Reveal({ children, delay = 0, y = 16, rotate = -1.4, as, className, style }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const vars: CSSVars = {
    ...style,
    '--reveal-delay': `${delay}ms`,
    '--rise-y': `${y}px`,
    '--rise-r': `${rotate}deg`,
  }
  return (
    <Tag className={className ? `pp-reveal ${className}` : 'pp-reveal'} style={vars as CSSProperties}>
      {children}
    </Tag>
  )
}

export interface StaggerProps {
  children?: ReactNode
  /** Milliseconds between each child landing. */
  step?: number
  /** Milliseconds before the first one. */
  delay?: number
  y?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
}

/**
 * Deals its children onto the desk one after another. Wraps each child in a
 * Reveal, so it works with anything — no per-child props to remember.
 */
export function Stagger({ children, step = 55, delay = 0, y = 16, as, className, style }: StaggerProps) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag className={className} style={style}>
      {Children.toArray(children).map((child, i) =>
        isValidElement(child) ? (
          <Reveal key={(child as ReactElement).key ?? i} delay={delay + i * step} y={y} rotate={i % 2 ? 1.2 : -1.4}>
            {cloneElement(child)}
          </Reveal>
        ) : (
          child
        ),
      )}
    </Tag>
  )
}
