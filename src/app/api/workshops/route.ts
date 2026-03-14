import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Workshop from '@/models/Workshop'
import School from '@/models/School'
import { withErrorHandler } from '@/lib/monitor'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

// ─── GET /api/workshops ───────────────────────────────────────────────────────
export const GET = withErrorHandler(async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = req.nextUrl
  const page        = parseInt(searchParams.get('page')        || '1')
  const limit       = parseInt(searchParams.get('limit')       || '20')
  const status      = searchParams.get('status')
  const programType = searchParams.get('programType')
  const theme       = searchParams.get('theme')
  const month       = searchParams.get('month')
  const mode        = searchParams.get('mode')
  const schoolId    = searchParams.get('schoolId')

  const { role, id: userId } = session.user
  const filter: any = {}

  // Scope by role
  if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'CLASS_TEACHER', 'COORDINATOR'].includes(role)) {
    filter.schoolId = new mongoose.Types.ObjectId(session.user.schoolId!)
  } else if (role === 'PSYCHOLOGIST') {
    filter.conductedById = new mongoose.Types.ObjectId(userId)
  }
  // CITTAA_ADMIN / CITTAA_SUPPORT see all; optional schoolId filter
  if (schoolId && ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)) {
    filter.schoolId = new mongoose.Types.ObjectId(schoolId)
  }

  if (status && status !== 'ALL')          filter.status      = status
  if (programType && programType !== 'ALL') filter.programType = programType
  if (theme)  filter.theme = theme
  if (month)  filter.month = month
  if (mode && mode !== 'ALL') filter.mode = mode

  const skip = (page - 1) * limit
  const [workshops, total] = await Promise.all([
    Workshop.find(filter)
      .populate('schoolId',    'name code city')
      .populate('conductedById', 'name email')
      .sort({ plannedDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Workshop.countDocuments(filter),
  ])

  // Summary counts for the current filter (for dashboard header cards)
  const [planned, completed, cancelled] = await Promise.all([
    Workshop.countDocuments({ ...filter, status: 'PLANNED' }),
    Workshop.countDocuments({ ...filter, status: 'COMPLETED' }),
    Workshop.countDocuments({ ...filter, status: { $in: ['CANCELLED', 'POSTPONED'] } }),
  ])

  return NextResponse.json({
    workshops,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    summary: { total, planned, completed, cancelled },
  })
}, { route: '/api/workshops' })

// ─── POST /api/workshops ──────────────────────────────────────────────────────
export const POST = withErrorHandler(async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = session.user
  if (!['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'PSYCHOLOGIST'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const body = await req.json()
  const {
    title, schoolId, programType, theme, targetGroup, gradeRange,
    plannedDate, month, week, mode, durationMinutes, seriesType,
    priority, conductedById, materialPreparedBy, plannedAttendance,
    comments, isFromTemplate,
  } = body

  if (!title || !programType || !theme || !targetGroup) {
    return NextResponse.json({ error: 'Missing required fields: title, programType, theme, targetGroup' }, { status: 400 })
  }

  // School scoping
  const resolvedSchoolId = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
    ? schoolId
    : session.user.schoolId

  if (!resolvedSchoolId) {
    return NextResponse.json({ error: 'School not identified' }, { status: 400 })
  }

  const workshop = await Workshop.create({
    title,
    schoolId:     resolvedSchoolId,
    programType,
    theme,
    targetGroup,
    gradeRange,
    plannedDate:  plannedDate ? new Date(plannedDate) : undefined,
    month,
    week,
    mode:         mode || 'OFFLINE',
    durationMinutes: durationMinutes || 45,
    seriesType:   seriesType || 'ONE_TIME',
    priority:     priority || 'MEDIUM',
    status:       'PLANNED',
    conductedById,
    materialPreparedBy,
    plannedAttendance,
    comments,
    isFromTemplate: isFromTemplate || false,
    academicYear: '2026-27',
  })

  const populated = await Workshop.findById(workshop._id)
    .populate('schoolId',     'name code')
    .populate('conductedById', 'name email')
    .lean()

  return NextResponse.json({ workshop: populated }, { status: 201 })
}, { route: '/api/workshops' })
