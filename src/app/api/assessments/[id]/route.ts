import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Assessment from '@/models/Assessment'
import CounselingRequest from '@/models/CounselingRequest'
import RCIReport from '@/models/RCIReport'
import User from '@/models/User'
import Notification from '@/models/Notification'
import { sendRCINotificationEmail } from '@/lib/email'

// GET /api/assessments/:id — fetch full assessment details
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const assessment = await Assessment.findById(params.id)
    .populate({
      path: 'requestId',
      populate: [
        { path: 'studentId', select: 'name class section age gender parentName parentPhone' },
        { path: 'schoolId',  select: 'name address city state phone email' },
        { path: 'submittedById', select: 'name email role' },
      ],
    })
    .populate('requestedById', 'name email role')
    .populate('approvedById',  'name email role')
    .lean()

  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // School-scoped roles can only see assessments for their school
  const schoolRoles = ['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN']
  if (schoolRoles.includes(session.user.role)) {
    const school = (assessment.requestId as any)?.schoolId as any
    const schoolId = school?._id?.toString() || school?.toString()
    if (schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Fetch linked RCI report if any
  const rciReport = await RCIReport.findOne({ assessmentId: params.id })
    .populate('assignedToId', 'name email phone')
    .lean()

  return NextResponse.json({ assessment, rciReport })
}

// Approve or reject assessment, and if approved — assign RCI
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['SCHOOL_PRINCIPAL', 'CITTAA_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const { action, approvalNote, rejectionReason, rciMemberId } = await req.json()

  const assessment = await Assessment.findById(params.id)
    .populate({ path: 'requestId', populate: [{ path: 'studentId', select: 'name' }, { path: 'schoolId', select: 'name address city state' }] })
    .populate('requestedById', 'name email')

  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (assessment.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Assessment is not pending approval' }, { status: 400 })
  }

  assessment.approvedById = session.user.id as any
  assessment.status = action === 'approve' ? 'APPROVED' : 'REJECTED'
  if (approvalNote)     assessment.approvalNote    = approvalNote
  if (rejectionReason)  assessment.rejectionReason = rejectionReason

  await assessment.save()

  const request = assessment.requestId as any
  const student = request.studentId
  const school  = request.schoolId

  // Update parent request status
  const parentRequest = await CounselingRequest.findById(request._id)
  if (parentRequest) {
    parentRequest.status = (action === 'approve' ? 'ASSESSMENT_APPROVED' : 'ASSESSMENT_REJECTED') as any
    parentRequest.statusHistory.push({
      status: parentRequest.status,
      changedBy: session.user.id as any,
      note: action === 'approve' ? `Assessment approved. ${approvalNote || ''}` : `Assessment rejected: ${rejectionReason}`,
      timestamp: new Date(),
    })
    await parentRequest.save()
  }

  // Notify the psychologist who requested
  const requestedBy = assessment.requestedById as any
  await Notification.create({
    userId: requestedBy._id,
    title: action === 'approve' ? 'Assessment Approved' : 'Assessment Rejected',
    message: action === 'approve'
      ? `Your assessment request for ${student.name} has been approved`
      : `Your assessment request was rejected: ${rejectionReason}`,
    type: action === 'approve' ? 'ASSESSMENT_APPROVED' : 'ASSESSMENT_REJECTED',
    link: `/dashboard/assessments/${assessment._id}`,
    relatedId: assessment._id.toString(),
  })

  let rciReport = null

  // If approved and RCI member provided — create RCI assignment
  if (action === 'approve' && rciMemberId) {
    const rciMember = await User.findById(rciMemberId)
    if (!rciMember || rciMember.role !== 'RCI_TEAM') {
      return NextResponse.json({ error: 'Invalid RCI team member' }, { status: 400 })
    }

    rciReport = await RCIReport.create({
      assessmentId:  assessment._id,
      requestId:     request._id,
      schoolId:      school._id,
      assignedToId:  rciMemberId,
      assignedById:  session.user.id,
      status:        'NOTIFIED',
      notifiedAt:    new Date(),
    })

    // Update parent request status to RCI_NOTIFIED
    if (parentRequest) {
      parentRequest.status = 'RCI_NOTIFIED' as any
      parentRequest.statusHistory.push({
        status: 'RCI_NOTIFIED',
        changedBy: session.user.id as any,
        note: `RCI team member ${rciMember.name} assigned for school visit`,
        timestamp: new Date(),
      })
      await parentRequest.save()
    }

    await Promise.all([
      Notification.create({
        userId: rciMemberId,
        title: 'New RCI Visit Assignment',
        message: `You have been assigned to visit ${school.name} for an assessment of ${student.name}`,
        type: 'RCI_ASSIGNED',
        link: `/dashboard/rci/${rciReport._id}`,
        relatedId: rciReport._id.toString(),
      }),
      sendRCINotificationEmail({
        to: rciMember.email,
        rciMemberName: rciMember.name,
        requestNumber: request.requestNumber,
        studentName: student.name,
        schoolName: school.name,
        schoolAddress: `${school.address}, ${school.city}, ${school.state}`,
        assessmentType: assessment.type,
        rciReportId: rciReport._id.toString(),
      }),
    ])
  }

  return NextResponse.json({ assessment, rciReport })
}
