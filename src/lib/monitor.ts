/**
 * monitor.ts — API error tracking, circuit breaker, and withErrorHandler wrapper.
 *
 * Every API route wrapped with withErrorHandler:
 *  - Never crashes the server on an unhandled exception
 *  - Returns a structured JSON error instead of an empty 500
 *  - Logs to console (Railway captures this in deployment logs)
 *  - Tracks error counts per route for the health endpoint
 */
import { NextRequest, NextResponse } from 'next/server'

// ── In-process error registry ─────────────────────────────────────────────────
type RouteStats = {
  errors:   number
  lastError: string
  lastAt:   Date
}

const _routeStats = new Map<string, RouteStats>()

export function getRouteStats() {
  return Object.fromEntries(_routeStats.entries())
}

// ── Circuit breaker: if a route fails >10 times/minute, fast-fail ─────────────
const CIRCUIT_THRESHOLD = 10
const CIRCUIT_WINDOW_MS = 60_000   // 1 minute
const _circuitOpen = new Map<string, number>()   // route → window start

function isCircuitOpen(route: string, count: number): boolean {
  const windowStart = _circuitOpen.get(route)
  if (!windowStart) { _circuitOpen.set(route, Date.now()); return false }
  if (Date.now() - windowStart > CIRCUIT_WINDOW_MS) {
    // Reset window
    _circuitOpen.set(route, Date.now())
    const stats = _routeStats.get(route)
    if (stats) stats.errors = 0
    return false
  }
  return count >= CIRCUIT_THRESHOLD
}

// ── Main wrapper ──────────────────────────────────────────────────────────────
type Handler = (req: NextRequest, ctx?: any) => Promise<NextResponse>

export function withErrorHandler(
  handler: Handler,
  options: { route?: string } = {}
): Handler {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    const route = options.route ?? req.nextUrl.pathname
    const stats = _routeStats.get(route) ?? { errors: 0, lastError: '', lastAt: new Date() }

    // Circuit breaker check
    if (isCircuitOpen(route, stats.errors)) {
      console.error(`[Monitor] Circuit open for ${route} (${stats.errors} errors/min)`)
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again in a moment.', circuit: 'open' },
        { status: 503 }
      )
    }

    try {
      return await handler(req, ctx)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const stack   = err instanceof Error ? err.stack   : undefined

      // Update stats
      stats.errors++
      stats.lastError = message
      stats.lastAt    = new Date()
      _routeStats.set(route, stats)

      // Log with enough context to debug from Railway logs
      console.error(
        `[Monitor] ${req.method} ${route} — ${message}`,
        process.env.NODE_ENV !== 'production' ? stack : ''
      )

      // Never expose stack traces in production
      const body: any = {
        error:   'An unexpected error occurred. Please try again.',
        route,
        timestamp: new Date().toISOString(),
      }
      if (process.env.NODE_ENV !== 'production') {
        body.detail  = message
        body.stack   = stack
      }

      return NextResponse.json(body, { status: 500 })
    }
  }
}
