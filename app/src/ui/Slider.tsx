// PAPER PLANET — <Slider>: a boxwood ruler with a paper thumb.

import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import { usePaperSound, type CSSVars } from './hooks'

export interface SliderProps {
  value: number
  onChange: (next: number) => void
  /** Fired once when the thumb is let go — the moment to save. */
  onCommit?: (next: number) => void
  min?: number
  max?: number
  step?: number
  label?: ReactNode
  /** Render the value however it reads best: "72%", "Soft", "3 of 7". */
  format?: (value: number) => string
  accent?: AccentToken
  /** Score the ruler into this many divisions. */
  ticks?: number
  disabled?: boolean
  ariaLabel?: string
  className?: string
  style?: CSSProperties
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export function Slider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  format,
  accent = 'ai',
  ticks = 10,
  disabled = false,
  ariaLabel,
  className,
  style,
}: SliderProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const play = usePaperSound()
  const lastTick = useRef(value)

  const span = max - min || 1
  const pct = clamp((value - min) / span, 0, 1)

  const quantise = useCallback(
    (raw: number): number => {
      const snapped = step > 0 ? Math.round((raw - min) / step) * step + min : raw
      return clamp(Math.round(snapped * 1e6) / 1e6, min, max)
    },
    [min, max, step],
  )

  const fromClientX = useCallback(
    (clientX: number): number => {
      const rail = railRef.current
      if (!rail) return value
      const box = rail.getBoundingClientRect()
      const t = clamp((clientX - box.left) / Math.max(1, box.width), 0, 1)
      return quantise(min + t * span)
    },
    [min, span, quantise, value],
  )

  const emit = (next: number): void => {
    if (next === value) return
    // one tick of paper per notch crossed, never a stream of them
    if (Math.abs(next - lastTick.current) >= span / 24) {
      lastTick.current = next
      play('ui.tap')
    }
    onChange(next)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    railRef.current?.focus()
    emit(fromClientX(e.clientX))
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging || disabled) return
    emit(fromClientX(e.clientX))
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    play('sheet.settle')
    onCommit?.(value)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return
    const big = span / 5
    const map: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: big,
      PageDown: -big,
    }
    if (e.key === 'Home') {
      e.preventDefault()
      onChange(min)
      onCommit?.(min)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
      onCommit?.(max)
      return
    }
    const delta = map[e.key]
    if (delta === undefined) return
    e.preventDefault()
    const next = quantise(value + delta)
    emit(next)
    onCommit?.(next)
  }

  const text = format ? format(value) : `${Math.round(pct * 100)}%`
  const vars: CSSVars = { ...style, '--slider-v': `${(pct * 100).toFixed(2)}%`, '--tick-n': ticks }

  return (
    <div
      className={className ? `pp-slider ${className}` : 'pp-slider'}
      data-accent={accent}
      style={vars as CSSProperties}
    >
      {label ? (
        <div className="pp-slider__head">
          <span className="pp-label">{label}</span>
          <span className="pp-label pp-num">{text}</span>
        </div>
      ) : null}
      <div
        ref={railRef}
        className="pp-slider__rail"
        data-dragging={dragging ? 'true' : undefined}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuenow={Math.round(value * 1e4) / 1e4}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={text}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{ opacity: disabled ? 0.45 : undefined }}
      >
        <div className="pp-slider__track">
          <div className="pp-slider__fill" />
          {ticks > 0 ? <div className="pp-slider__ticks" /> : null}
        </div>
        <div className="pp-slider__thumb" />
      </div>
    </div>
  )
}
