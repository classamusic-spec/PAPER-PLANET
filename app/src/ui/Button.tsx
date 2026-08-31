// PAPER PLANET — <Button>: a folded card that lies proud of the desk and presses flat.

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import { Icon, type IconName } from './Icon'
import { stableTilt } from './paperShapes'
import { useSeed, usePaperSound, type CSSVars, type PaperCue } from './hooks'

const ACCENTS: readonly AccentToken[] = ['beni', 'kincha', 'matcha', 'ai', 'murasaki', 'sakura', 'gold-leaf', 'ink']

function isAccent(v: string): v is AccentToken {
  return (ACCENTS as readonly string[]).includes(v)
}

/**
 * How the card is made:
 * - an accent token → a solid card dyed with it
 * - `soft`  → a washed card, ink label
 * - `ghost` → uncoloured card with a cut edge
 * - `quiet` → no card at all; a bare label for tertiary actions
 */
export type ButtonVariant = AccentToken | 'solid' | 'soft' | 'ghost' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode
  variant?: ButtonVariant
  /** The dye, when `variant` doesn't name one. */
  accent?: AccentToken
  size?: ButtonSize
  /** Fill the available width. */
  block?: boolean
  /** A cut-paper icon before the label. */
  icon?: IconName | ReactNode
  /** A cut-paper icon after the label (chevrons, external links). */
  iconAfter?: IconName | ReactNode
  /** Hold the card flat — for a toggle that is currently on. */
  pressed?: boolean
  /** The paper sound this button makes. `null` to stay silent. */
  cue?: PaperCue | null
  /** Stable irregularity seed. */
  seed?: string | number
  style?: CSSProperties
}

function renderIcon(icon: IconName | ReactNode, size: ButtonSize): ReactNode {
  if (icon == null) return null
  if (typeof icon === 'string') {
    return <Icon name={icon as IconName} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />
  }
  return icon
}

/**
 * Every Button is a 44×44pt touch target, `size="sm"` included: `.pp-target`
 * reserves the room in the element's own box, not only in a pseudo-element, so
 * a finger, a focus ring and an audit all agree on where the control is.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'beni',
    accent,
    size = 'md',
    block = false,
    icon,
    iconAfter,
    pressed,
    cue = 'ui.tap',
    seed,
    className,
    style,
    type = 'button',
    onClick,
    onPointerDown,
    disabled,
    ...rest
  },
  ref,
) {
  const key = useSeed(seed)
  const play = usePaperSound()
  const kind = isAccent(variant) ? 'solid' : variant
  const dye = isAccent(variant) ? variant : (accent ?? 'beni')

  const vars: CSSVars = { ...style, '--pp-tilt': `${stableTilt(key, 0.55)}deg` }

  return (
    <button
      ref={ref}
      type={type}
      className={className ? `pp-btn pp-target ${className}` : 'pp-btn pp-target'}
      data-variant={kind}
      data-accent={dye}
      data-size={size}
      data-block={block ? 'true' : undefined}
      data-pressed={pressed ? 'true' : undefined}
      aria-pressed={pressed}
      disabled={disabled}
      style={vars as CSSProperties}
      onPointerDown={(e) => {
        if (!disabled && cue) play('press.flatten')
        onPointerDown?.(e)
      }}
      onClick={(e) => {
        if (!disabled && cue) play(cue)
        onClick?.(e)
      }}
      {...rest}
    >
      {icon ? <span className="pp-btn__icon">{renderIcon(icon, size)}</span> : null}
      {children ? <span className="pp-btn__label">{children}</span> : null}
      {iconAfter ? <span className="pp-btn__icon">{renderIcon(iconAfter, size)}</span> : null}
    </button>
  )
})

/** A square button that is only an icon. It still needs a name. */
export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'children' | 'iconAfter'> {
  icon: IconName | ReactNode
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', className, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      size={size}
      aria-label={label}
      className={className ? `pp-btn--icon ${className}` : 'pp-btn--icon'}
      {...rest}
    >
      {renderIcon(icon, size)}
    </Button>
  )
})
