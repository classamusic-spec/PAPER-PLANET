import { sfx } from '../game/audio'

export default function PushButton({
  children,
  onClick,
  variant = '',
  size = '',
  disabled = false,
  quiet = false,
  style,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'sage' | 'sun' | 'sky' | 'ghost' | ''
  size?: 'sm' | ''
  disabled?: boolean
  quiet?: boolean
  style?: React.CSSProperties
  ariaLabel?: string
}) {
  return (
    <button
      className={`push-btn ${variant} ${size}`}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => {
        if (disabled) return
        if (!quiet) sfx.click()
        onClick?.()
      }}
    >
      {children}
    </button>
  )
}
