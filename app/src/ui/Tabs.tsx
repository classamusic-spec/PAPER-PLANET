// PAPER PLANET — <Tabs>: index cards in a box. The active card is pulled forward.

import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AccentToken } from '../contracts'
import { Icon, type IconName } from './Icon'
import { stableTilt } from './paperShapes'
import { usePaperSound, type CSSVars } from './hooks'

export interface TabItem {
  id: string
  label: ReactNode
  icon?: IconName
  /** The stripe along the top of the raised card. */
  accent?: AccentToken
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  /** Accessible name for the tablist — "Codex sections", "Shop". */
  label: string
  /** The panel body. Render the active tab's content here. */
  children?: ReactNode
  /** Skip the panel wrapper when the tabs steer a whole screen instead. */
  bare?: boolean
  className?: string
  style?: CSSProperties
}

export function Tabs({ items, value, onChange, label, children, bare = false, className, style }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const play = usePaperSound()

  const move = (delta: number): void => {
    const enabled = items.filter((t) => !t.disabled)
    if (enabled.length === 0) return
    const at = Math.max(0, enabled.findIndex((t) => t.id === value))
    const next = enabled[(at + delta + enabled.length) % enabled.length]
    onChange(next.id)
    play('sheet.flip')
    window.requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus()
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      move(-items.length)
    } else if (e.key === 'End') {
      e.preventDefault()
      move(items.length)
    }
  }

  return (
    <div className={className ? `pp-tabs ${className}` : 'pp-tabs'} style={style}>
      <div className="pp-tabs__list" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
        {items.map((tab) => {
          const selected = tab.id === value
          const vars: CSSVars = { '--pp-tilt': `${stableTilt(`tab-${tab.id}`, 0.7)}deg` }
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`pp-tab-${tab.id}`}
              data-tab-id={tab.id}
              data-accent={tab.accent ?? 'beni'}
              className="pp-tab"
              aria-selected={selected}
              aria-controls={bare ? undefined : `pp-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              style={vars as CSSProperties}
              onClick={() => {
                if (tab.id === value) return
                play('sheet.flip')
                onChange(tab.id)
              }}
            >
              {tab.icon ? <Icon name={tab.icon} size="sm" /> : null}
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
      {bare ? (
        children
      ) : (
        <div className="pp-tabs__panel" role="tabpanel" id={`pp-panel-${value}`} aria-labelledby={`pp-tab-${value}`}>
          {children}
        </div>
      )}
    </div>
  )
}
