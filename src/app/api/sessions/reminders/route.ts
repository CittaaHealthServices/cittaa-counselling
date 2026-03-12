/**
 * POST /api/sessions/reminders
 * ─────────────────────────────
 * Called by a cron job (Railway cron or external scheduler) once per hour.
 * Finds sessions scheduled in the next 24 hours that haven't had a reminder
 * sent yet, and notifies the submitting teacher/coordinator.
 *
 * Secure with a shared CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Session from '@/models/Session'
import CounselingRequest from '@/models/CounselingRequest'
import User from '@/models/User'
import Notification from '@/models/Notification'
import { sendSessionReminderEmail } from '@/lib/email-observations'

// We track which sessions have had reminders sent via a simple Set stored in
// a lightweight ReminderLog (or we can just add a flag to Session model).
// For simplicity we add a reminderSentAt field check in the Session model via
// a runtime patch — stored as session metadata.

export async function POST(req: NextRequest) {
  // Validate cron secret
  const authHeader = req.headers.get('authorization')
  const expected   = `Bearer ${process.env.CRON_SECRET}`
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const now      = new Date()
  const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in2h     = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  // Find scheduled sessions in the next 24 hours
  const upcomingSessions = await Session.find({
    status:      'SCHEDULED',
    scheduledAt: { $gte: now, $lte: in24h },
  })
    .populate('psychologistId', 'name email')
    .populate('substituteId',   'name email')
    .lean()

  let sent = 0
  const results: string[] = []

  for (const s of upcomingSessions) {
    const sessionId = (s._id as any).toString()

    // Check if we already sent a reminder (stored as a metadata flag)
    // We use a lightweight check via Notification model: if a SESSION_REMINDER
    // notification exists for this session relatedId, skip it.
    const alreadySent = await Notification.findOne({
      type:      'SESSION_REMINDER',
      relatedId: sessionId,
    })
    if (alreadySent) continue

    // Get the parent request with submitter and student
    const request = await CounselingRequest.findById(s.requestId)
      .populate('submittedById', 'name email')
      .populate('studentId',     'name class section')
      .populate('schoolId',      'name')
      .lean() as any

    if (!request) continue

    const submitter    = request.submittedById as any
    const student      = request.studentId as any
    const psych        = (s.substituteId || s.psychologistId) as any
    const hoursUntil   = Math.round((new Date(s.scheduledAt).getTime() - now.getTime()) / (1000 * 60 * 60))

    const scheduledStr = new Date(s.scheduledAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    // Create in-app notification
    await Notification.create({
      userId:    submitter._id,
      title:     `Session Reminder: ${student.name}`,
      message:   `Counselling session for ${student.name} is scheduled ${hoursUntil <= 2 ? 'soon' : hoursUntil <= 24 ? 'tomorrow' : 'soon'} at ${scheduledStr}`,
      type:      'SESSION_REMINDER',
      isRead:    false,
      link:      `/dashboard/requests/${request._id}`,
      relatedId: sessionId,   // marks that reminder was sent for this session
    })

    // Send email reminder
    await sendSessionReminderEmail({
      to:              submitter.email,
      teacherName:     submitter.name,
      studentName:     student.name,
      studentClass:    `${student.class}${student.section ? ` – ${student.section}` : ''}`,
      requestNumber:   request.requestNumber,
      scheduledAt:     scheduledStr,
      psychologistName: psych?.name || 'Assigned Psychologist',
      hoursUntil,
      requestId:       request._id.toString(),
    })

    sent++
    results.push(`${request.requestNumber} – ${student.name} (${scheduledStr})`)
  }

  return NextResponse.json({
    checked: upcomingSessions.length,
    remindersSent: sent,
    sessions: results,
  })
}

// ─── GET /api/sessions/reminders — teacher's upcoming session list ────────────
export async function GET(req: NextRequest) {
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, id: userId, schoolId } = session.user

  // Only relevant for school users
  if (!['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL', 'PSYCHOLOGIST'].includes(role)) {
    return NextResponse.json({ upcoming: [] })
  }

  const now  = new Date()
  const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Get request IDs scoped to this user/school
  let requestIds: any[] = []

  if (role === 'PSYCHOLOGIST') {
    // Their own sessions
    const sessions = await Session.find({
      psychologistId: userId,
      status:         'SCHEDULED',
      scheduledAt:    { $gte: now, $lte: next7 },
    })
      .populate('psychologistId', 'name')
      .populate({
        path: 'requestId',
        populate: [
          { path: 'studentId', select: 'name class section' },
          { path: 'schoolId',  select: 'name code city' },
        ],
      })
      .sort({ scheduledAt: 1 })
      .limit(20)
      .lean()
    return NextResponse.json({ upcoming: sessions })
  }

  // School users — find requests for their school
  const { default: mongoose } = await import('mongoose')
  const schoolRequests = await CounselingRequest.find(
    role === 'SCHOOL_PRINCIPAL'
      ? { schoolId: new mongoose.Types.ObjectId(schoolId!) }
      : { submittedById: new mongoose.Types.ObjectId(userId) },
    '_id'
  ).lean()
  requestIds = schoolRequests.map((r: any) => r._id)

  const upcoming = await Session.find({
    requestId:   { $in: requestIds },
    status:      'SCHEDULED',
    scheduledAt: { $gte: now, $lte: next7 },
  })
    .populate('psychologistId', 'name email isAvailable')
    .populate('substituteId',   'name email')
    .populate({
      path: 'requestId',
      populate: [
        { path: 'studentId', select: 'name class section' },
        { path: 'schoolId',  select: 'name code city' },
      ],
    })
    .sort({ scheduledAt: 1 })
    .limit(20)
    .lean()

  return NextResponse.json({ upcoming })
}
