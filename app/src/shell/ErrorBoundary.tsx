/* PAPER PLANET — error boundary. A crash is a torn sheet, not a stack trace. */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Called on catch so the host can log or reset state. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
    if (import.meta.env.DEV) console.error('[PAPER PLANET]', error, info.componentStack)
  }

  private reload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="pp-crash" role="alert">
        <svg viewBox="0 0 120 90" aria-hidden="true" className="pp-crash__art">
          {/* a torn sheet */}
          <path
            d="M14 8 H106 V44 L96 50 L104 56 L92 62 L102 70 L88 74 L98 82 H14 Z"
            fill="var(--paper-0)"
            stroke="var(--paper-edge)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M30 26 H78 M30 38 H68 M30 50 H74" stroke="var(--ink-faint)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <h1 className="pp-crash__title">This sheet tore.</h1>
        <p className="pp-crash__body">
          Something went wrong. Your collection is safe — it&rsquo;s saved on this device.
        </p>
        <button type="button" className="pp-crash__btn" onClick={this.reload}>
          Start a fresh sheet
        </button>
        {import.meta.env.DEV && (
          <pre className="pp-crash__detail">{error.message}</pre>
        )}
      </div>
    )
  }
}
