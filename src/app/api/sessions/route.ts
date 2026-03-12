import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Session from '@/models/Session'
import CounselingRequest from '@/models/CounselingRequest'
import Notification from '@/models/Notification'
import User from '@/models/User'
import { sendSessionScheduledEmail } from '@/lib/email'
import mongoose from 'mongoose'

// ─── GET /api/sessions ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, id: userId, schoolId } = session.user
  const filter: any = {}

  if (role === 'PSYCHOLOGIST') {
    filter.psychologistId = new mongoose.Types.ObjectId(userId)
  } else if (role === 'RCI_TEAM') {
    // RCI doesn't need sessions view
    return NextResponse.json({ sessions: [] })
  } else if (['SCHOOL_PRINCIPAL', 'COORDINATOR', 'CLASS_TEACHER'].includes(role)) {
    // Get all request IDs for this school
    const schoolRequests = await CounselingRequest.find(
      { schoolId: new mongoose.Types.ObjectId(schoolId!) },
      '_id'
    ).lean()
    filter.requestId = { $in: schoolRequests.map((r: any) => r._id) }
  }

  const status = req.nextUrl.searchParams.get('status')
  if (status) filter.status = status

  const sessions = await Session.find(filter)
    .populate('psychologistId', 'name email isAvailable')
    .populate('substituteId', 'name email')
    .populate({
      path: 'requestId',
      select: 'requestNumber concernCategory priority status',
      populate: [
        { path: 'studentId', select: 'name class section' },
        { path: 'schoolId', select: 'name code city' },
      ],
    })
    .sort({ scheduledAt: 1 })
    .lean()

  return NextResponse.json({ sessions })
}

// ─── POST /api/sessions — schedule a session ──────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'PSYCHOLOGIST') {
    return NextResponse.json({ error: 'Only psychologists can schedule sessions' }, { status: 403 })
  }

  await connectDB()

  const { requestId, scheduledAt, durationMinutes, notes, substituteId, substituteReason } = await req.json()

  const request = await CounselingRequest.findById(requestId)
    .populate('studentId', 'name')
    .populate('schoolId', 'name')
    .populate('submittedById', 'name email')

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (!['APPROVED', 'PSYCHOLOGIST_ASSIGNED'].includes(request.status)) {
    return NextResponse.json({ error: 'Request must be assigned before scheduling' }, { status: 400 })
  }

  // Determine the psychologist
  const psychologistId = substituteId || session.user.id

  const newSession = await Session.create({
    requestId,
    psychologistId: session.user.id,
    substituteId:   substituteId || undefined,
    substituteReason,
    scheduledAt: new Date(scheduledAt),
    durationMinutes: durationMinutes || 45,
    status: 'SCHEDULED',
    notes,
  })

  // Update request status
  request.status = 'SESSION_SCHEDULED' as any
  request.statusHistory.push({
    status: 'SESSION_SCHEDULED',
    changedBy: session.user.id as any,
    note: `Session scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}`,
    timestamp: new Date(),
  })
  await request.save()

  const student  = request.studentId as any
  const school   = request.schoolId as any
  const submitter = request.submittedById as any

  // Notify submitter
  const psychologist = await User.findById(session.user.id, 'name email')

  await Promise.all([
    Notification.create({
      userId: submitter._id,
      title: 'Session Scheduled',
      message: `Session for ${student.name} scheduled on ${new Date(scheduledAt).toLocaleString('en-IN')}`,
      type: 'SESSION_SCHEDULED',
      link: `/dashboard/requests/${requestId}`,
      relatedId: requestId,
    }),
    sendSessionScheduledEmail({
      to: submitter.email,
      recipientName: submitter.name,
      requestNumber: request.requestNumber,
      studentName: student.name,
      scheduledAt: new Date(scheduledAt).toLocaleString('en-IN'),
      psychologistName: psychologist?.name || 'Assigned Psychologist',
      requestId: requestId.toString(),
    }),
  ])

  return NextResponse.json({ session: newSession }, { status: 201 })
}
