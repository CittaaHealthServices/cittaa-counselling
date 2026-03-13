import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import AuditLog from '@/models/AuditLog'
import mongoose from 'mongoose'

/**
 * GET /api/audit
 *
 * Query params:
 *   userId     — filter by specific user
 *   resourceId — filter by a specific document (e.g. a request ID)
 *   action     — filter by action type
 *   schoolId   — filter by school
 *   from       — ISO date start
 *   to         — ISO date end
 *   page       — default 1
 *   limit      — default 50, max 200
 *
 * Access:
 *   CITTAA_ADMIN       — all logs
 *   CITTAA_SUPPORT     — all logs (read-only)
 *   SCHOOL_PRINCIPAL   — logs for their school only
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, schoolId: userSchoolId } = session.user
  const allowedRoles = ['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL']
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()

  const { searchParams } = req.nextUrl
  const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'))
  const skip  = (page - 1) * limit

  const filter: any = {}

  // Scope school principals to their own school
  if (role === 'SCHOOL_PRINCIPAL' && userSchoolId) {
    filter.schoolId = userSchoolId
  } else {
    // Optional filters for admins
    if (searchParams.get('schoolId')) filter.schoolId = searchParams.get('schoolId')
  }

  if (searchParams.get('userId'))     filter.userId     = new mongoose.Types.ObjectId(searchParams.get('userId')!)
  if (searchParams.get('resourceId')) filter.resourceId = searchParams.get('resourceId')
  if (searchParams.get('action'))     filter.action     = searchParams.get('action')

  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to)   filter.createdAt.$lte = new Date(to)
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ])

  return NextResponse.json({
    logs,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}
