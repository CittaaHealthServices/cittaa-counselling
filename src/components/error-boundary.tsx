'use client'
/**
 * ErrorBoundary — catches React rendering crashes (blank pages).
 *
 * Wrap any subtree with <ErrorBoundary>.  The dashboard layout wraps
 * the entire page area so any unhandled render error is caught here
 * instead of going blank.
 *
 * On mount it also attaches window.onerror + unhandledrejection listeners
 * to catch JS runtime errors outside React's render cycle.
 */

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  /** Optional label shown in the error UI and sent with the report */
  context?: string
}

interface State {
  hasError:  boolean
  message:   string
  errorId?:  string
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  // ── Static listeners (attached once globally) ────────────────────────────
  static _listenersAttached = false

  componentDidMount() {
    if (ErrorBoundary._listenersAttached) return
    ErrorBoundary._listenersAttached = true

    // Unhandled JS errors (outside React render)
    window.onerror = (msg, src, line, col, err) => {
      ErrorBoundary._report('FRONTEND_CRASH', {
        message:  String(msg),
        stack:    err?.stack,
        metadata: { src, line, col },
      })
    }

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      ErrorBoundary._report('FRONTEND_CRASH', {
        message:  e.reason?.message ?? String(e.reason) ?? 'Unhandled promise rejection',
        stack:    e.reason?.stack,
      })
    })
  }

  // ── React error boundary ─────────────────────────────────────────────────
  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message ?? 'Unknown render error' }
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    ErrorBoundary._report('FRONTEND_CRASH', {
      message:  err?.message ?? 'Unknown render error',
      stack:    err?.stack,
      metadata: {
        componentStack: info.componentStack,
        context: this.props.context,
      },
    }).then((id) => {
      if (id) this.setState({ errorId: id })
    })
  }

  // ── Report helper ────────────────────────────────────────────────────────
  static async _report(
    type: 'FRONTEND_CRASH',
    details: { message: string; stack?: string; metadata?: Record<string, any> }
  ): Promise<string | undefined> {
    try {
      const res = await fetch('/api/errors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          route:    window.location.pathname,
          ...details,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        return d.id
      }
    } catch { /* never block the UI */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-500 text-sm mb-1 leading-relaxed">
            An unexpected error occurred on this page. The Cittaa team has been notified automatically.
          </p>
          {this.state.errorId && (
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Ref: {this.state.errorId}
            </p>
          )}
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-5 font-mono text-left break-all">
            {this.state.message}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: '', errorId: undefined })
              window.location.reload()
            }}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
