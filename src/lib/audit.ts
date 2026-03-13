/**
 * audit.ts — Lightweight helper to write audit log entries.
 *
 * Usage (in any API route after getServerSession):
 *
 *   await writeAudit(session, {
 *     action: 'REQUEST_APPROVED',
 *     resource: 'CounselingRequest',
 *     resourceId: request._id.toString(),
 *     schoolId: request.schoolId?.toString(),
 *     details: { previousStatus: 'PENDING_APPROVAL', newStatus: 'APPROVED' },
 *     req,  // NextRequest — extracts IP + UA automatically
 *   })
 *
 * writeAudit never throws — log failures are silent to avoid blocking user actions.
 */

import { Session } from 'next-auth'
import { NextRequest } from 'next/server'
import connectDB from '@/lib/db'
import AuditLog, { AuditAction } from '@/models/AuditLog'

interface WriteAuditOptions {
  action:      AuditAction
  resource:    string
  resourceId:  string
  schoolId?:   string
  details?:    Record<string, any>
  req?:        NextRequest
}

export async function writeAudit(
  session: Session,
  opts: WriteAuditOptions
): Promise<void> {
  try {
    await connectDB()

    const ipAddress = opts.req
      ? (opts.req.headers.get('x-forwarded-for') ||
         opts.req.headers.get('x-real-ip') ||
         'unknown')
      : undefined

    const userAgent = opts.req
      ? opts.req.headers.get('user-agent') || undefined
      : undefined

    await AuditLog.create({
      userId:     session.user.id,
      userEmail:  session.user.email || '',
      userRole:   session.user.role,
      action:     opts.action,
      resource:   opts.resource,
      resourceId: opts.resourceId,
      schoolId:   opts.schoolId || session.user.schoolId || undefined,
      details:    opts.details,
      ipAddress,
      userAgent,
    })
  } catch (err) {
    // Never let audit log failures block the main request
    console.error('[AuditLog] Failed to write audit entry:', err)
  }
}
