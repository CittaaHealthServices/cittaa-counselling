/**
 * monitor.ts — centralised error monitoring for Cittaa
 *
 * Exports:
 *   logError(type, details)   — silently saves an error to DB + optional email alert
 *   withErrorHandler(handler) — wraps a Next.js route handler with crash + slow-API detection
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ErrorLog, { ErrorType } from '@/models/ErrorLog'

// ── Types ──────────────────────────────────────────────────────────────────
export interface ErrorDetails {
  route:       string
  method?:     string
  message:     string
  stack?:      string
  statusCode?: number
  durationMs?: number
  userId?:     string
  userEmail?:  string
  userRole?:   string
  schoolId?:   string
  ipAddress?:  string
  userAgent?:  string
  metadata?:   Record<string, any>
}

// ── Slow-API threshold (ms) ────────────────────────────────────────────────
const SLOW_THRESHOLD_MS = 3000

// ── Routes that should NOT trigger email alerts (high-volume / expected) ───
const SILENT_ROUTES = new Set(['/api/auth', '/api/notifications'])

// ── logError ───────────────────────────────────────────────────────────────
/**
 * Saves an error to the ErrorLog collection.
 * Sends an email alert for API_CRASH and FRONTEND_CRASH types.
 * Never throws — all failures are console.error'd only.
 */
export async function logError(type: ErrorType, details: ErrorDetails): Promise<void> {
  try {
    await connectDB()
    await ErrorLog.create({ type, ...details })
  } catch (err) {
    console.error('[monitor] Failed to save ErrorLog:', err)
  }

  // Email alert for critical crashes (not SLOW_API or AUTH_FAILURE)
  if (
    (type === 'API_CRASH' || type === 'FRONTEND_CRASH') &&
    !SILENT_ROUTES.has(details.route)
  ) {
    try {
      await sendErrorAlert(type, details)
    } catch (err) {
      console.error('[monitor] Failed to send error alert email:', err)
    }
  }
}

// ── sendErrorAlert ─────────────────────────────────────────────────────────
async function sendErrorAlert(type: ErrorType, d: ErrorDetails): Promise<void> {
  const { sendErrorAlertEmail } = await import('@/lib/email')
  await sendErrorAlertEmail({
    type,
    route:      d.route,
    method:     d.method,
    message:    d.message,
    stack:      d.stack,
    statusCode: d.statusCode,
    durationMs: d.durationMs,
    userId:     d.userId,
    userEmail:  d.userEmail,
    userRole:   d.userRole,
    ipAddress:  d.ipAddress,
  })
}

// ── withErrorHandler ───────────────────────────────────────────────────────
/**
 * Wraps a Next.js App Router handler with:
 *   1. try/catch → logs API_CRASH + returns 500
 *   2. timing → logs SLOW_API if response takes > SLOW_THRESHOLD_MS
 *   3. extracts session context for richer error reports
 *
 * Usage:
 *   export const GET = withErrorHandler(async (req) => { ... })
 *   export const POST = withErrorHandler(async (req, ctx) => { ... }, { route: '/api/requests' })
 */
export function withErrorHandler(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse | Response>,
  opts?: { route?: string }
) {
  return async function wrappedHandler(req: NextRequest, ctx?: any): Promise<NextResponse | Response> {
    const start = Date.now()
    const route = opts?.route ?? req.nextUrl.pathname
    const method = req.method

    // Try to pull session context for richer logs
    let userId: string | undefined
    let userEmail: string | undefined
    let userRole: string | undefined
    let schoolId: string | undefined
    try {
      const { getToken } = await import('next-auth/jwt')
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      if (token) {
        userId    = token.id as string
        userEmail = token.email as string
        userRole  = token.role  as string
        schoolId  = token.schoolId as string
      }
    } catch { /* non-critical */ }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   ?? req.headers.get('x-real-ip')
                   ?? undefined
    const userAgent = req.headers.get('user-agent') ?? undefined

    try {
      const response = await handler(req, ctx)
      const durationMs = Date.now() - start

      // Log slow responses
      if (durationMs > SLOW_THRESHOLD_MS) {
        logError('SLOW_API', {
          route, method, durationMs,
          message: `Response took ${durationMs}ms (threshold: ${SLOW_THRESHOLD_MS}ms)`,
          userId, userEmail, userRole, schoolId, ipAddress, userAgent,
        }).catch(() => {})
      }

      return response
    } catch (err: any) {
      const durationMs = Date.now() - start
      console.error(`[${method}] ${route} crashed after ${durationMs}ms:`, err)

      // Log asynchronously — don't block the 500 response
      logError('API_CRASH', {
        route, method,
        message:    err?.message ?? 'Unknown error',
        stack:      err?.stack,
        statusCode: 500,
        durationMs,
        userId, userEmail, userRole, schoolId, ipAddress, userAgent,
      }).catch(() => {})

      return NextResponse.json(
        { error: 'An unexpected server error occurred. The Cittaa team has been notified.' },
        { status: 500 }
      )
    }
  }
}
