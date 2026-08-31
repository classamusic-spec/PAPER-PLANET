// PAPER PLANET — the cut-paper icon set. Solid silhouettes, scissored from one sheet.

import type { CSSProperties } from 'react'
import type { AccentToken } from '../contracts'
import { CRANE_FACETS, CRANE_ICON_TRANSFORM } from './crane'

/* ── every icon lives in a 24×24 sheet ───────────────────────────────────── */

export type IconName =
  | 'home' | 'planet' | 'codex' | 'shop' | 'settings'
  | 'fold' | 'scissors' | 'crane' | 'heart' | 'sheets' | 'goldleaf' | 'sparkle'
  | 'sound-on' | 'sound-off' | 'back' | 'close' | 'check' | 'lock' | 'chevron' | 'plus'
  | 'camera' | 'moon' | 'sun' | 'star' | 'leaf' | 'water' | 'mountain' | 'cloud'
  | 'gift' | 'crown' | 'info' | 'share' | 'rotate' | 'hand' | 'pinch' | 'tap'

/** A cut piece of paper. `tone` is how much light falls on that facet. */
interface Piece {
  d: string
  tone?: 'main' | 'soft' | 'deep'
  rule?: 'evenodd'
  transform?: string
}

/* ── two shapes are easier to compute than to hand-letter ────────────────── */

const P = (n: number): string => String(Math.round(n * 100) / 100)

/** A cog with an odd number of teeth — nothing here is machine-made. */
function gear(teeth: number, rOuter: number, rInner: number, cx = 12, cy = 12): string {
  const step = (Math.PI * 2) / teeth
  const half = step * 0.29
  let d = ''
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2
    const pts: Array<[number, number]> = [
      [a - half, rOuter],
      [a + half, rOuter],
      [a + half + step * 0.21, rInner],
      [a + step - half - step * 0.21, rInner],
    ]
    pts.forEach(([ang, r], k) => {
      const x = cx + Math.cos(ang) * r
      const y = cy + Math.sin(ang) * r
      d += `${i === 0 && k === 0 ? 'M' : 'L'}${P(x)} ${P(y)}`
    })
  }
  return d + 'Z'
}

/** A ring of tapered rays — the sun, and nothing else. */
function rays(count: number, r0: number, r1: number, spread: number, cx = 12, cy = 12): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    const tip: [number, number] = [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]
    const l: [number, number] = [cx + Math.cos(a - spread) * r0, cy + Math.sin(a - spread) * r0]
    const r: [number, number] = [cx + Math.cos(a + spread) * r0, cy + Math.sin(a + spread) * r0]
    d += `M${P(l[0])} ${P(l[1])}L${P(tip[0])} ${P(tip[1])}L${P(r[0])} ${P(r[1])}Z`
  }
  return d
}

/** A filled circle, written the long way so it can join an evenodd path. */
const disc = (cx: number, cy: number, r: number): string =>
  `M${P(cx - r)} ${P(cy)}a${P(r)} ${P(r)} 0 1 0 ${P(r * 2)} 0a${P(r)} ${P(r)} 0 1 0 ${P(-r * 2)} 0Z`

const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${P(cx - rx)} ${P(cy)}a${P(rx)} ${P(ry)} 0 1 0 ${P(rx * 2)} 0a${P(rx)} ${P(ry)} 0 1 0 ${P(-rx * 2)} 0Z`

/* ── the set ─────────────────────────────────────────────────────────────── */

const GLYPHS: Record<IconName, Piece[]> = {
  home: [
    { d: 'M12 1.9 1.4 11.7h3.1v8.6c0 .9.7 1.6 1.6 1.6h3.3v-6.3h5.2v6.3h3.3c.9 0 1.6-.7 1.6-1.6v-8.6h3.1Z' },
    { d: 'M12 4.6 4.6 11.4h14.8Z', tone: 'soft' },
  ],

  planet: [
    {
      d: `${ellipse(12, 12.4, 11.6, 4.4)}${ellipse(12, 12.4, 7.2, 1.5)}`,
      rule: 'evenodd',
      transform: 'rotate(-21 12 12.4)',
      tone: 'deep',
    },
    { d: disc(12, 11.4, 6.9) },
    { d: 'M12 4.5a6.9 6.9 0 0 1 0 13.8Z', tone: 'soft' },
  ],

  codex: [
    { d: 'M1.9 4.9 11.1 6.8v13.9L1.9 18.8Z' },
    { d: 'M22.1 4.9 12.9 6.8v13.9l9.2-1.9Z', tone: 'soft' },
    { d: 'M11.1 6.6h1.8v14.1h-1.8Z', tone: 'deep' },
    { d: 'M4.3 9.1l4.6.9v1.7l-4.6-.9Zm0 3.4 4.6.9v1.7l-4.6-.9Z', tone: 'deep' },
  ],

  shop: [
    { d: 'M12 1.3a5.3 5.3 0 0 0-5.3 5.3v2.7h3V6.6a2.3 2.3 0 0 1 4.6 0v2.7h3V6.6A5.3 5.3 0 0 0 12 1.3Z', tone: 'soft' },
    { d: 'M4.1 7.9h15.8l1 12.5c.1.9-.6 1.7-1.5 1.7H4.6c-.9 0-1.6-.8-1.5-1.7Z' },
    { d: 'M8.4 11.4v2.1a3.6 3.6 0 0 0 7.2 0v-2.1h-1.9v2.1a1.7 1.7 0 0 1-3.4 0v-2.1Z', tone: 'deep' },
  ],

  settings: [
    { d: `${gear(7, 10.4, 7.3)}${disc(12, 12, 3.5)}`, rule: 'evenodd' },
  ],

  fold: [
    { d: 'M3.4 2.8h11.2v6.2h6.2v0.5L3.4 20.3Z' },
    { d: 'M3.4 20.5 20.8 10.1v10.7H3.4Z', tone: 'soft' },
    { d: 'M14.6 2.8 20.8 9h-6.2Z', tone: 'deep' },
  ],

  scissors: [
    { d: 'M4.4 1.5 2.3 3.1l14.7 16.7 2.4-1.8Z' },
    { d: 'M19.6 1.5l2.1 1.6L7 19.8l-2.4-1.8Z', tone: 'soft' },
    { d: `${disc(19.2, 19.4, 2.8)}${disc(19.2, 19.4, 1.2)}`, rule: 'evenodd' },
    { d: `${disc(4.8, 19.4, 2.8)}${disc(4.8, 19.4, 1.2)}`, rule: 'evenodd', tone: 'soft' },
    { d: disc(11.9, 11.4, 1.4), tone: 'deep' },
  ],

  crane: [
    ...CRANE_FACETS.map((facet) => ({
      d: facet.d,
      tone: facet.shade === 'deep' ? ('deep' as const) : facet.shade === 'soft' ? ('soft' as const) : undefined,
      transform: CRANE_ICON_TRANSFORM,
    })),
  ],

  heart: [
    { d: 'M12 21.7 2.4 10.8 6.2 3.2 12 6.5l5.8-3.3 3.8 7.6Z' },
    { d: 'M12 21.7 2.4 10.8 6.2 3.2 12 6.5Z', tone: 'soft' },
  ],

  sheets: [
    { d: 'M6.6 2.3 21.4 4.6 20.1 12.2 5.3 9.9Z', tone: 'deep' },
    { d: 'M4.3 6.8 19.2 7.3 19 15.3 4.1 14.8Z', tone: 'soft' },
    { d: 'M2.6 11.5 17.5 10.1 18.5 19.7 3.6 21.1Z' },
  ],

  goldleaf: [
    { d: 'M4.3 3.4 20.1 5.2 18.7 19.4 2.9 17.8Z' },
    { d: 'M4.3 3.4 20.1 5.2 10.4 12.2Z', tone: 'soft' },
    { d: 'M17.9 13c.5 2.9 1.4 3.8 4.3 4.4-2.9.6-3.8 1.5-4.3 4.4-.5-2.9-1.4-3.8-4.3-4.4 2.9-.6 3.8-1.5 4.3-4.4Z' },
  ],

  sparkle: [
    { d: 'M9.8 1.2c1.1 5.7 2.9 7.5 8.6 8.7-5.7 1.2-7.5 3-8.6 8.7-1.1-5.7-2.9-7.5-8.6-8.7 5.7-1.2 7.5-3 8.6-8.7Z' },
    { d: 'M18.5 12.9c.6 3.2 1.5 4.1 4.7 4.8-3.2.7-4.1 1.6-4.7 4.8-.6-3.2-1.5-4.1-4.7-4.8 3.2-.7 4.1-1.6 4.7-4.8Z', tone: 'soft' },
  ],

  'sound-on': [
    { d: 'M11.1 3.1 5.6 8H2.7c-.8 0-1.4.6-1.4 1.4v5.2c0 .8.6 1.4 1.4 1.4h2.9l5.5 4.9c.9.8 1.8.3 1.8-.8V3.9c0-1.1-.9-1.6-1.8-.8Z' },
    { d: 'M15.6 8.7a4.4 4.4 0 0 1 0 6.6l1.8 1.9a6.9 6.9 0 0 0 0-10.4Z', tone: 'deep' },
    { d: 'M18.9 5.2a9 9 0 0 1 0 13.6l1.8 1.9a11.5 11.5 0 0 0 0-17.4Z', tone: 'soft' },
  ],

  'sound-off': [
    { d: 'M11.1 3.1 5.6 8H2.7c-.8 0-1.4.6-1.4 1.4v5.2c0 .8.6 1.4 1.4 1.4h2.9l5.5 4.9c.9.8 1.8.3 1.8-.8V3.9c0-1.1-.9-1.6-1.8-.8Z' },
    { d: 'M16.1 8.2 17.9 6.4 22.7 11.2 20.9 13Z', tone: 'deep' },
    { d: 'M20.9 6.4 22.7 8.2 17.9 13 16.1 11.2Z', tone: 'deep' },
  ],

  back: [
    { d: 'M2.4 12 12.6 3.1v17.8Z' },
    { d: 'M11.2 10.1h10.4v3.8H11.2Z', tone: 'soft' },
  ],

  close: [
    { d: 'M5.3 3 21 18.7l-2.3 2.3L3 5.3Z' },
    { d: 'M18.7 3 21 5.3 5.3 21 3 18.7Z', tone: 'soft' },
  ],

  check: [{ d: 'M9.5 20 2 12.5l2.8-2.8 4.7 4.7L19.2 4l2.8 2.8Z' }],

  lock: [
    { d: 'M12 1.2a5.5 5.5 0 0 0-5.5 5.5v4.1h3.3V6.7a2.2 2.2 0 0 1 4.4 0v4.1h3.3V6.7A5.5 5.5 0 0 0 12 1.2Z', tone: 'soft' },
    {
      d: 'M4.7 10h14.6c.9 0 1.6.7 1.6 1.6v9.1c0 .9-.7 1.6-1.6 1.6H4.7c-.9 0-1.6-.7-1.6-1.6v-9.1c0-.9.7-1.6 1.6-1.6ZM12 13.5a1.9 1.9 0 0 0-1 3.5v1.9h2v-1.9a1.9 1.9 0 0 0-1-3.5Z',
      rule: 'evenodd',
    },
  ],

  chevron: [{ d: 'M8.6 2.9 6.2 5.3l6.7 6.7-6.7 6.7 2.4 2.4L17.7 12Z' }],

  plus: [{ d: 'M9.9 2.6h4.2v7.3h7.3v4.2h-7.3v7.3H9.9v-7.3H2.6V9.9h7.3Z' }],

  camera: [
    { d: 'M8.6 2.2h6.8l1.7 3H6.9Z', tone: 'soft' },
    {
      d: 'M2.6 5.1h18.8c1 0 1.8.8 1.8 1.8v12.5c0 1-.8 1.8-1.8 1.8H2.6c-1 0-1.8-.8-1.8-1.8V6.9c0-1 .8-1.8 1.8-1.8ZM12 8.5a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z',
      rule: 'evenodd',
    },
    { d: disc(12, 13.1, 2.6), tone: 'deep' },
  ],

  moon: [
    { d: 'M13.1 1.7a10.2 10.2 0 1 0 9.1 13.5A8 8 0 0 1 13.1 1.7Z' },
    { d: 'M6.6 6.1a8.3 8.3 0 0 0 3.6 13.9 8.3 8.3 0 0 1-3.6-13.9Z', tone: 'soft' },
  ],

  sun: [
    { d: rays(8, 7.2, 11.7, 0.3), tone: 'soft' },
    { d: disc(12, 12, 6.2) },
    { d: 'M12 5.8a6.2 6.2 0 0 1 0 12.4Z', tone: 'deep' },
  ],

  star: [{ d: 'M12 1.4 15.3 8.5 22.9 9.4 17.2 14.6 18.8 22.2 12 18.4 5.2 22.2 6.8 14.6 1.1 9.4 8.7 8.5Z' }],

  leaf: [
    { d: 'M21.6 2.4c-9.8-.7-18 4.7-19 12.7-.4 3.3.7 5.8 2.5 6.8Z' },
    { d: 'M21.6 2.4 5.1 21.9c1.9 1 4.5.5 7-.9 6.7-3.9 10.4-11.6 9.5-18.6Z', tone: 'deep' },
  ],

  water: [
    { d: 'M1.2 5.6c2.6-2.5 5.1-2.5 7.7 0 2.3 2.2 4.2 2.2 6.5 0 2.6-2.5 5.1-2.5 7.7 0v4.4c-2.6-2.5-5.1-2.5-7.7 0-2.3 2.2-4.2 2.2-6.5 0-2.6-2.5-5.1-2.5-7.7 0Z' },
    { d: 'M1.2 14c2.6-2.5 5.1-2.5 7.7 0 2.3 2.2 4.2 2.2 6.5 0 2.6-2.5 5.1-2.5 7.7 0v4.4c-2.6-2.5-5.1-2.5-7.7 0-2.3 2.2-4.2 2.2-6.5 0-2.6-2.5-5.1-2.5-7.7 0Z', tone: 'deep' },
  ],

  mountain: [
    { d: 'M6.6 7.2 14.4 21.2H0.4Z', tone: 'deep' },
    { d: 'M15.3 3.2 23.8 21.2H6.4Z' },
    { d: 'M15.3 3.2 20 13.1 17.2 11.2 15.3 13.2 13.2 11.2 10.6 13.1Z', tone: 'soft' },
  ],

  cloud: [
    { d: disc(8.3, 13.1, 4.5) },
    { d: disc(13.4, 10.6, 5.6) },
    { d: disc(17.7, 14, 3.9) },
    { d: 'M8.3 13.1h9.4v6.5H8.3Z' },
    { d: `${disc(13.4, 10.6, 5.6)}`, tone: 'soft' },
  ],

  gift: [
    { d: 'M2.2 5.6h19.6v4.8H2.2Z', tone: 'soft' },
    { d: 'M3.6 10.4h16.8v9.9a1.9 1.9 0 0 1-1.9 1.9H5.5a1.9 1.9 0 0 1-1.9-1.9Z' },
    { d: 'M9.9 5.6h4.2v16.6H9.9Z', tone: 'deep' },
    { d: 'M12 5.4C9.9 1.3 6.7-.3 4.4 1.1 2.3 2.4 2.8 5 5.3 5.4Zm0 0c2.1-4.1 5.3-5.7 7.6-4.3 2.1 1.3 1.6 3.9-.9 4.3Z' },
  ],

  crown: [
    { d: 'M1.6 6.8 6.8 12.4 12 3.6l5.2 8.8 5.2-5.6-1.6 12.9c-.1.9-.9 1.5-1.8 1.5H5c-.9 0-1.7-.6-1.8-1.5Z' },
    { d: 'M4 17.6h16l-.5 4.1c-.1.9-.9 1.5-1.8 1.5H6.3c-.9 0-1.7-.6-1.8-1.5Z', tone: 'deep' },
  ],

  info: [
    {
      d: `${disc(12, 12, 10.3)}M10.5 10.2h3v7.6h-3Z${disc(12, 7.1, 1.7)}`,
      rule: 'evenodd',
    },
  ],

  share: [
    { d: 'M8.2 10 16.5 5.3 18 7.9 9.7 12.6Z', tone: 'deep' },
    { d: 'M9.7 11.4 18 16.1 16.5 18.7 8.2 14Z', tone: 'deep' },
    { d: disc(18.3, 5.3, 3.4) },
    { d: disc(5.4, 12, 3.6) },
    { d: disc(18.3, 18.7, 3.4), tone: 'soft' },
  ],

  rotate: [
    { d: 'M12 5.8a6.2 6.2 0 1 0 6.2 6.2h3.4A9.6 9.6 0 1 1 12 2.4Z' },
    { d: 'M9.1 2.4 15.3 5.4 9.1 8.9Z', tone: 'soft' },
  ],

  hand: [
    {
      d: 'M7.7 22.4c-1.7-1.9-3.9-4.5-4.7-6.4-.8-1.8.7-3.2 2.1-2.5l2 1V4.4a1.6 1.6 0 0 1 3.2 0v5.7h.7V2.4a1.6 1.6 0 0 1 3.2 0v7.7h.7V3.5a1.6 1.6 0 0 1 3.2 0v6.6h.7V6.3a1.6 1.6 0 0 1 3.2 0v9c0 3.6-1.6 5.5-2.8 7.1Z',
    },
    { d: 'M5.1 13.5c-1.4-.7-2.9.7-2.1 2.5.8 1.9 3 4.5 4.7 6.4h2.4c-1.9-2.4-3.9-5.6-5-8.9Z', tone: 'soft' },
  ],

  pinch: [
    { d: 'M2.6 2.6h8.2L2.6 10.8Z' },
    { d: 'M21.4 21.4h-8.2l8.2-8.2Z', tone: 'deep' },
    { d: 'M5.4 5.4 12.6 7.4 7.4 12.6Z', tone: 'soft' },
    { d: 'M18.6 18.6 11.4 16.6l5.2-5.2Z', tone: 'soft' },
  ],

  tap: [
    { d: `${disc(12, 16.2, 6.8)}${disc(12, 16.2, 5)}`, rule: 'evenodd', tone: 'soft' },
    { d: disc(12, 16.2, 3.1) },
    { d: 'M12 1a2 2 0 0 1 2 2v3.4h-4V3a2 2 0 0 1 2-2Z', tone: 'deep' },
    { d: 'M6.4 3.4 8.2 5.2 6 7.4 4.2 5.6ZM17.6 3.4 19.4 5.2 17.2 7.4 15.4 5.6Z', tone: 'soft' },
  ],
}

/* ── the component ───────────────────────────────────────────────────────── */

const SIZES = { sm: 16, md: 20, lg: 26, xl: 34 } as const

export interface IconProps {
  name: IconName
  /** Pixel size, or one of the named steps. Default `md` (20px). */
  size?: number | keyof typeof SIZES
  /**
   * Accessible name. Omit it for a decorative icon and it becomes
   * `aria-hidden` — which is correct beside a text label.
   */
  title?: string
  /** Paint the icon in an accent dye instead of inheriting the ink. */
  accent?: AccentToken
  /** Draw the tiny offset shadow that says "this was cut from a sheet". */
  cut?: boolean
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 'md', title, accent, cut = true, className, style }: IconProps) {
  const px = typeof size === 'number' ? size : SIZES[size]
  const pieces = GLYPHS[name]
  const body = pieces.map((piece, i) => (
    <path
      key={i}
      d={piece.d}
      fillRule={piece.rule}
      clipRule={piece.rule}
      transform={piece.transform}
      className={piece.tone && piece.tone !== 'main' ? `pp-icon__${piece.tone}` : undefined}
    />
  ))

  return (
    <svg
      className={className ? `pp-icon ${className}` : 'pp-icon'}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={accent ? ({ ...style, color: `var(--${accent})` } as CSSProperties) : style}
    >
      {title ? <title>{title}</title> : null}
      {cut ? (
        <g className="pp-icon__cut" fill="var(--icon-cut)" transform="translate(0.55 0.75)">
          {pieces.map((piece, i) => (
            <path key={i} d={piece.d} fillRule={piece.rule} clipRule={piece.rule} transform={piece.transform} />
          ))}
        </g>
      ) : null}
      <g>{body}</g>
    </svg>
  )
}

/** Every name in the set — handy for a gallery or a picker. */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[]
