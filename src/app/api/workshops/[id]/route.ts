import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Workshop from '@/models/Workshop'
import { withErrorHandler } from '@/lib/monitor'
import mongoose from 'mongoose'

// ─── GET /api/workshops/[id] ──────────────────────────────────────────────────
export const GET = withErrorHandler(async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const workshop = await Workshop.findById(params.id)
    .populate('schoolId',     'name code city')
    .populate('conductedById', 'name email role')
    .lean()

  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 })

  return NextResponse.json({ workshop })
}, { route: '/api/workshops/[id]' })

// ─── PATCH /api/workshops/[id] ────────────────────────────────────────────────
export const PATCH = withErrorHandler(async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const workshop = await Workshop.findById(params.id)
  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 })

  const { role } = session.user
  // School staff can only edit workshops for their own school
  if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)) {
    if (workshop.schoolId.toString() !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (!['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'PSYCHOLOGIST'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = [
    'title', 'programType', 'theme', 'targetGroup', 'gradeRange',
    'plannedDate', 'actualDate', 'month', 'week', 'mode', 'durationMinutes',
    'seriesType', 'priority', 'status', 'conductedById', 'materialPreparedBy',
    'materialStatus', 'plannedAttendance', 'actualAttendance', 'feedbackScore',
    'keyObservations', 'followUpRequired', 'followUpNotes', 'comments',
  ]

  for (const key of allowed) {
    if (key in body) {
      if (key === 'plannedDate' || key === 'actualDate') {
        (workshop as any)[key] = body[key] ? new Date(body[key]) : undefined
      } else {
        (workshop as any)[key] = body[key]
      }
    }
  }

  await workshop.save()

  const updated = await Workshop.findById(params.id)
    .populate('schoolId',     'name code')
    .populate('conductedById', 'name email')
    .lean()

  return NextResponse.json({ workshop: updated })
}, { route: '/api/workshops/[id]' })

// ─── DELETE /api/workshops/[id] ───────────────────────────────────────────────
export const DELETE = withErrorHandler(async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = session.user
  if (!['CITTAA_ADMIN', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const workshop = await Workshop.findById(params.id)
  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 })

  if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)) {
    if (workshop.schoolId.toString() !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await Workshop.findByIdAndDelete(params.id)
  return NextResponse.json({ success: true })
}, { route: '/api/workshops/[id]' })
