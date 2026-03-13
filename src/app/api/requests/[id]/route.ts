import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import CounselingRequest from '@/models/CounselingRequest'
import Session from '@/models/Session'
import Assessment from '@/models/Assessment'
import RCIReport from '@/models/RCIReport'
import Notification from '@/models/Notification'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const request = await CounselingRequest.findById(params.id)
    .populate('studentId', 'name class section rollNumber age gender parentName parentPhone')
    .populate('schoolId', 'name code city state address phone email')
    .populate('submittedById', 'name email role')
    .populate('assignedPsychologistId', 'name email phone qualification specialization isAvailable')
    .populate('substitutePsychologistId', 'name email phone')
    .populate('approvedById', 'name email role')
    .populate({ path: 'statusHistory.changedBy', select: 'name role' })
    .lean()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch related sessions and assessments
  const [sessions, assessments] = await Promise.all([
    Session.find({ requestId: params.id })
      .populate('psychologistId', 'name email')
      .populate('substituteId', 'name email')
      .sort({ scheduledAt: -1 })
      .lean(),
    Assessment.find({ requestId: params.id })
      .populate('requestedById', 'name email')
      .populate('approvedById', 'name email')
      .lean(),
  ])

  // Fetch RCI reports for approved assessments
  const assessmentIds = assessments.map((a: any) => a._id)
  const rciReports = await RCIReport.find({ assessmentId: { $in: assessmentIds } })
    .populate('assignedToId', 'name email phone')
    .lean()

  return NextResponse.json({ request, sessions, assessments, rciReports })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const body = await req.json()
  const { priority, isConfidential, description, action, closingNote } = body

  const request = await CounselingRequest.findById(params.id)
    .populate('studentId', 'name')
    .populate('submittedById', 'name email')
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── CLOSE action (CITTAA_ADMIN or SCHOOL_PRINCIPAL after report submitted) ──
  if (action === 'close') {
    const canClose =
      session.user.role === 'CITTAA_ADMIN' ||
      (session.user.role === 'SCHOOL_PRINCIPAL' &&
        request.schoolId?.toString() === session.user.schoolId)

    if (!canClose) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const closableStatuses = [
      'SESSION_COMPLETED', 'ASSESSMENT_REJECTED', 'RCI_REPORT_SUBMITTED', 'APPROVED', 'PSYCHOLOGIST_ASSIGNED',
    ]
    if (!closableStatuses.includes(request.status)) {
      return NextResponse.json(
        { error: `Cannot close a request with status ${request.status}` },
        { status: 400 }
      )
    }

    request.status = 'CLOSED' as any
    request.statusHistory.push({
      status: 'CLOSED',
      changedBy: session.user.id as any,
      note: closingNote || 'Case closed',
      timestamp: new Date(),
    })
    await request.save()

    // Notify submitter
    const submitter = request.submittedById as any
    if (submitter?._id) {
      await Notification.create({
        userId:    submitter._id,
        title:     'Case Closed',
        message:   `The counselling case for ${(request.studentId as any).name} (${request.requestNumber}) has been closed.`,
        type:      'GENERAL',
        link:      `/dashboard/requests/${request._id}`,
        relatedId: request._id.toString(),
      })
    }

    await writeAudit(session, {
      action: action === 'close' ? 'REQUEST_CLOSED' : 'REQUEST_EDITED',
      resource: 'CounselingRequest',
      resourceId: params.id,
      details: { action, closingNote },
      req,
    })
        return NextResponse.json({ request })
  }

  // ── EDIT action — only while PENDING_APPROVAL ─────────────────────────────
  const canEdit =
    session.user.role === 'CITTAA_ADMIN' ||
    request.submittedById?.toString() === session.user.id

  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (request.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Cannot edit an approved or processed request' }, { status: 400 })
  }

  if (priority)      request.priority      = priority
  if (description)   request.description   = description
  if (isConfidential !== undefined) request.isConfidential = isConfidential

  await request.save()
  return NextResponse.json({ request })
}
