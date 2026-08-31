import type { Animal } from '../game/animals'
import { GRAIN_URI } from '../game/grain'

/* Recolor any hex fill into the gold family, preserving lightness. */
function toGold(hex: string): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  // near-white stays cream, near-black becomes deep bronze
  if (l > 0.9) return '#FFF6DC'
  if (l < 0.35) return '#6B4E12'
  const light = Math.min(0.82, Math.max(0.42, l))
  return `hsl(45, 78%, ${Math.round(light * 100)}%)`
}

/* Renders a creature as sticker-outlined folded-paper polygons. */
export default function OrigamiAnimal({
  animal,
  size = 120,
  silhouette = false,
  gold = false,
  className = '',
  style,
}: {
  animal: Animal
  size?: number | string
  silhouette?: boolean
  gold?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
      aria-label={animal.name}
    >
      {animal.art.map((p, i) => {
        const fill = silhouette ? '#8d7ba8' : gold ? toGold(p.fill) : p.fill
        const strokeProps = p.noStroke
          ? {}
          : {
              stroke: silhouette ? '#8d7ba8' : gold ? '#FFE9A8' : 'var(--sticker)',
              strokeWidth: 6,
              strokeLinejoin: 'round' as const,
            }
        if (p.circle) {
          const [cx, cy, r] = p.circle
          return <circle key={i} cx={cx} cy={cy} r={r} fill={fill} {...strokeProps} />
        }
        if (p.line) {
          const [x1, y1, x2, y2] = p.line
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={silhouette ? '#8d7ba8' : gold ? toGold(p.fill) : p.fill}
              strokeWidth={5}
              strokeLinecap="round"
            />
          )
        }
        return <polygon key={i} points={p.pts} fill={fill} {...strokeProps} />
      })}
      {/* paper fiber grain over the whole creature, clipped to its silhouette */}
      {!silhouette && (
        <>
          <defs>
            <pattern id={`ppGrain-${animal.id}`} patternUnits="userSpaceOnUse" width="140" height="140">
              <image href={GRAIN_URI} width="140" height="140" />
            </pattern>
            <clipPath id={`ppClip-${animal.id}`}>
              {animal.art.map((p, i) =>
                p.circle ? (
                  <circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} />
                ) : p.pts ? (
                  <polygon key={i} points={p.pts} />
                ) : null,
              )}
            </clipPath>
          </defs>
          <rect
            x="0"
            y="0"
            width="200"
            height="200"
            fill={`url(#ppGrain-${animal.id})`}
            opacity={0.55}
            clipPath={`url(#ppClip-${animal.id})`}
            style={{ mixBlendMode: 'multiply', pointerEvents: 'none' }}
          />
        </>
      )}
    </svg>
  )
}
