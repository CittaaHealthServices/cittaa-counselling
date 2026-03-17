'use client'
import React from 'react'
import { RefreshCw, AlertTriangle, Home } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError:  boolean
  error:     Error | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    // Log to console (captured by Railway)
    console.error('[ErrorBoundary] Caught:', error.message, errorInfo.componentStack)
    // Could send to an external error service here
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError:   false,
      error:      null,
      errorInfo:  null,
      retryCount: prev.retryCount + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} className="text-red-500" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
              <p className="text-slate-500 text-sm mt-1">
                This section encountered an error. You can try refreshing it or go back to the dashboard.
              </p>
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <details className="mt-3 text-left">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                    Show error details
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition"
              >
                <RefreshCw size={14} />
                Try again {this.state.retryCount > 0 ? `(${this.state.retryCount})` : ''}
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition"
              >
                <Home size={14} />
                Dashboard
              </a>
            </div>
          </div>
        </div>
      )
    }

    return <>{this.props.children}</>
  }
}

// ── Lightweight hook-based wrapper for async data fetching ────────────────────
// Usage: wrap any fetch call to get auto-retry on network errors
export function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs    = 500
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let lastError: unknown
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return resolve(await fn())
      } catch (err) {
        lastError = err
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
        }
      }
    }
    reject(lastError)
  })
}
