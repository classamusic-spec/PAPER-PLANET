/* PAPER PLANET — the form parts: a printed section, a labelled field, a set of paper choices. */

import { useCallback, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon, Paper, type IconName } from '../../ui'

/* ═══════════════════════════════════════════════════════════════════════════
   A SECTION — one sheet of the form, with its heading printed at the top
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SectionProps {
  title: string
  /** One quiet line under the heading. */
  note?: string
  /** A tiny mark cut from the accent, so the sheets are told apart at a glance. */
  icon?: IconName
  seed: string
  tilt?: number
  children?: ReactNode
}

export function Section({ title, note, icon, seed, tilt, children }: SectionProps) {
  const id = useId()
  return (
    <Paper
      className="pp-set__sheet"
      as="section"
      elevation={2}
      edge="deckle"
      tone={0}
      tilt={tilt}
      seed={seed}
      aria-labelledby={id}
    >
      <header className="pp-set__sheethead">
        {icon ? <Icon name={icon} size="md" className="pp-set__sheeticon" /> : null}
        <h2 className="pp-set__sheettitle" id={id}>
          {title}
        </h2>
      </header>
      {note ? <p className="pp-set__sheetnote">{note}</p> : null}
      <div className="pp-set__rows">{children}</div>
    </Paper>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   A FIELD — a label, its one-line explanation, and whatever sets it
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FieldProps {
  label: string
  /** The one line, in the voice of a good craft kit. Never optional in practice. */
  hint?: string
  children?: ReactNode
  /** Lay the control under the label instead of beside it. */
  stacked?: boolean
}

export function Field({ label, hint, children, stacked = false }: FieldProps) {
  return (
    <div className="pp-set__field" data-stacked={stacked ? 'true' : undefined}>
      <div className="pp-set__fieldtext">
        <span className="pp-set__fieldlabel">{label}</span>
        {hint ? <span className="pp-set__fieldhint">{hint}</span> : null}
      </div>
      <div className="pp-set__fieldctl">{children}</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   A CHOICE — cards laid in a row. A real radiogroup: arrows move, space picks.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  /** A word, at most three. Printed under the label. */
  note?: string
  icon?: IconName
}

export interface ChoiceProps<T extends string> {
  /** Accessible name for the group. */
  label: string
  value: T
  options: readonly ChoiceOption<T>[]
  onChange: (next: T) => void
  /** Track width. `wide` lets options wrap into a grid. */
  layout?: 'row' | 'wrap'
}

export function Choice<T extends string>({ label, value, options, onChange, layout = 'row' }: ChoiceProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  const move = useCallback(
    (delta: number) => {
      const at = Math.max(0, options.findIndex((o) => o.value === value))
      const next = options[(at + delta + options.length) % options.length]
      onChange(next.value)
      window.requestAnimationFrame(() => {
        listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
      })
    },
    [options, value, onChange],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    }
  }

  return (
    <div
      ref={listRef}
      className="pp-set__choice"
      data-layout={layout}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            data-value={opt.value}
            className="pp-set__opt pp-target"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon ? <Icon name={opt.icon} size="md" /> : null}
            <span className="pp-set__optlabel">{opt.label}</span>
            {opt.note ? <span className="pp-set__optnote">{opt.note}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
