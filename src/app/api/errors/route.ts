import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import connectDB from '@/lib/db'
import ErrorLog from '@/models/ErrorLog'

export const dynamic = 'force-dynamic'

// ─── POST /api/errors — receive frontend crash reports ────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, route, message, stack, metadata } = body

    if (!type || !route || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Try to enrich with session context
    let userId: string | undefined
    let userEmail: string | undefined
    let userRole: string | undefined
    let schoolId: string | undefined
    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      if (token) {
        userId    = token.id    as string
        userEmail = token.email as string
        userRole  = token.role  as string
        schoolId  = token.schoolId as string
      }
    } catch { /* non-critical */ }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   ?? req.headers.get('x-real-ip')
                   ?? undefined
    const userAgent = req.headers.get('user-agent') ?? undefined

    await connectDB()
    const doc = await ErrorLog.create({
      type, route, message, stack, metadata,
      userId, userEmail, userRole, schoolId,
      ipAddress, userAgent,
    })

    // Fire email alert asynchronously (don't await — don't block the response)
    if (type === 'FRONTEND_CRASH') {
      import('@/lib/email').then(({ sendErrorAlertEmail }) => {
        sendErrorAlertEmail({
          type, route, message, stack,
          userId, userEmail, userRole, ipAddress,
        }).catch(() => {})
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, id: doc._id.toString() }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/errors failed:', err)
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 })
  }
}

// ─── GET /api/errors — list error logs (CITTAA_ADMIN only) ───────────────────
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token || !['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(token.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const { searchParams } = req.nextUrl
    const page       = parseInt(searchParams.get('page')   || '1')
    const limit      = parseInt(searchParams.get('limit')  || '30')
    const type       = searchParams.get('type')
    const resolved   = searchParams.get('resolved')
    const since      = searchParams.get('since')   // ISO date string

    const filter: any = {}
    if (type)     filter.type       = type
    if (resolved !== null && resolved !== '') filter.isResolved = resolved === 'true'
    if (since)    filter.createdAt  = { $gte: new Date(since) }

    const skip = (page - 1) * limit
    const [errors, total] = await Promise.all([
      ErrorLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ErrorLog.countDocuments(filter),
    ])

    // Summary counts for the dashboard header
    const [summary] = await ErrorLog.aggregate([
      {
        $group: {
          _id: null,
          total:      { $sum: 1 },
          unresolved: { $sum: { $cond: [{ $eq: ['$isResolved', false] }, 1, 0] } },
          crashes:    { $sum: { $cond: [{ $in: ['$type', ['API_CRASH', 'FRONTEND_CRASH']] }, 1, 0] } },
          authFails:  { $sum: { $cond: [{ $eq: ['$type', 'AUTH_FAILURE'] }, 1, 0] } },
          slowApis:   { $sum: { $cond: [{ $eq: ['$type', 'SLOW_API'] }, 1, 0] } },
          todayCount: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                1, 0,
              ],
            },
          },
        },
      },
    ])

    return NextResponse.json({
      errors,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: summary ?? { total: 0, unresolved: 0, crashes: 0, authFails: 0, slowApis: 0, todayCount: 0 },
    })
  } catch (err: any) {
    console.error('GET /api/errors failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── PATCH /api/errors — mark as resolved ────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token || token.role !== 'CITTAA_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 })
    }

    await ErrorLog.updateMany(
      { _id: { $in: ids } },
      { $set: { isResolved: true, resolvedAt: new Date(), resolvedBy: token.email } }
    )

    return NextResponse.json({ ok: true, resolved: ids.length })
  } catch (err: any) {
    console.error('PATCH /api/errors failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
