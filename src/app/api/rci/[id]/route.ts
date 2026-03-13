import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import RCIReport from '@/models/RCIReport'
import CounselingRequest from '@/models/CounselingRequest'
import Notification from '@/models/Notification'

// RCI team updates their visit status + submits findings
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const body = await req.json()
  const { status, visitDate, findings, recommendations, reportUrl, internalNotes } = body

  const report = await RCIReport.findById(params.id)
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAllowed =
    session.user.role === 'CITTAA_ADMIN' ||
    report.assignedToId.toString() === session.user.id

  if (!isAllowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (status)                report.status          = status as any
  if (visitDate)             report.visitDate        = new Date(visitDate)
  if (findings)              report.findings         = findings
  if (recommendations)       report.recommendations  = recommendations
  if (reportUrl !== undefined)   (report as any).reportUrl    = reportUrl
  // internalNotes only editable by Cittaa admin
  if (internalNotes !== undefined && session.user.role === 'CITTAA_ADMIN') {
    (report as any).internalNotes = internalNotes
  }

  if (status === 'REPORT_SUBMITTED') {
    report.reportSubmittedAt = new Date()
  }

  await report.save()

  // Update parent request status
  if (status === 'REPORT_SUBMITTED') {
    const request = await CounselingRequest.findById(report.requestId)
    if (request) {
      request.status = 'RCI_REPORT_SUBMITTED' as any
      request.statusHistory.push({
        status: 'RCI_REPORT_SUBMITTED',
        changedBy: session.user.id as any,
        note: 'RCI field visit completed, report submitted',
        timestamp: new Date(),
      })
      await request.save()

      // Notify Cittaa admins
      const admins = await (await import('@/models/User')).default.find({ role: 'CITTAA_ADMIN', isActive: true })
      await Promise.all(admins.map((a) =>
        Notification.create({
          userId: a._id,
          title: 'RCI Report Submitted',
          message: `RCI report for request ${request.requestNumber} has been submitted`,
          type: 'RCI_REPORT_READY',
          link: `/dashboard/rci/${report._id}`,
          relatedId: report._id.toString(),
        })
      ))
    }
  } else if (status === 'VISIT_SCHEDULED') {
    const request = await CounselingRequest.findById(report.requestId)
    if (request) {
      request.status = 'RCI_VISITING' as any
      request.statusHistory.push({
        status: 'RCI_VISITING',
        changedBy: session.user.id as any,
        note: `RCI visit scheduled for ${visitDate ? new Date(visitDate).toLocaleDateString('en-IN') : 'TBD'}`,
        timestamp: new Date(),
      })
      await request.save()
    }
  }

  await writeAudit(session, {
    action: status === 'REPORT_SUBMITTED' ? 'RCI_REPORT_SUBMITTED' : 'RCI_STATUS_UPDATED',
    resource: 'RCIReport',
    resourceId: params.id,
    details: { status, visitDate },
    req,
  })

  return NextResponse.json({ report })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const report = await RCIReport.findById(params.id)
    .populate('assignedToId', 'name email phone')
    .populate('assignedById', 'name email')
    .populate({
      path: 'assessmentId',
      populate: { path: 'requestedById', select: 'name email' },
    })
    .populate({
      path: 'requestId',
      populate: [
        { path: 'studentId', select: 'name class section age gender parentName parentPhone' },
        { path: 'schoolId', select: 'name address city state phone email' },
        { path: 'submittedById', select: 'name email role' },
      ],
    })
    .populate('schoolId', 'name address city state')
    .lean()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ report })
}
