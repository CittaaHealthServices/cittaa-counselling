import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import CounselingRequest from '@/models/CounselingRequest'
import User from '@/models/User'
import Notification from '@/models/Notification'
import { sendPsychologistAssignedEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'CITTAA_ADMIN') {
    return NextResponse.json({ error: 'Only Cittaa Admin can assign psychologists' }, { status: 403 })
  }

  await connectDB()

  const { psychologistId, substituteReason } = await req.json()

  const request = await CounselingRequest.findById(params.id)
    .populate('studentId', 'name')
    .populate('schoolId', 'name city')
    .populate('submittedById', 'name email')

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Request must be approved before assigning psychologist' }, { status: 400 })
  }

  const psychologist = await User.findById(psychologistId)
  if (!psychologist || psychologist.role !== 'PSYCHOLOGIST') {
    return NextResponse.json({ error: 'Invalid psychologist' }, { status: 400 })
  }

  const isSubstitute = !psychologist.isAvailable
  const field = isSubstitute ? 'substitutePsychologistId' : 'assignedPsychologistId'

  // If primary unavailable, assign as substitute and also set primary
  if (isSubstitute) {
    request.substitutePsychologistId = psychologistId
  } else {
    request.assignedPsychologistId = psychologistId
  }

  request.status = 'PSYCHOLOGIST_ASSIGNED' as any
  request.statusHistory.push({
    status: 'PSYCHOLOGIST_ASSIGNED',
    changedBy: session.user.id as any,
    note: isSubstitute
      ? `Substitute psychologist ${psychologist.name} assigned. Reason: ${substituteReason || 'Primary unavailable'}`
      : `Psychologist ${psychologist.name} assigned`,
    timestamp: new Date(),
  })

  await request.save()

  const student = request.studentId as any
  const school  = request.schoolId as any
  const submitter = request.submittedById as any

  // Notifications
  await Promise.all([
    Notification.create({
      userId: psychologistId,
      title: 'New Case Assigned',
      message: `You have been assigned${isSubstitute ? ' as substitute' : ''} to a counselling case at ${school.name}`,
      type: 'PSYCHOLOGIST_ASSIGNED',
      link: `/dashboard/requests/${request._id}`,
      relatedId: request._id.toString(),
    }),
    Notification.create({
      userId: submitter._id,
      title: 'Psychologist Assigned',
      message: `${psychologist.name} has been assigned to ${student.name}'s request`,
      type: 'PSYCHOLOGIST_ASSIGNED',
      link: `/dashboard/requests/${request._id}`,
      relatedId: request._id.toString(),
    }),
    sendPsychologistAssignedEmail({
      toTeacher:       submitter.email,
      toPsychologist:  psychologist.email,
      teacherName:     submitter.name,
      psychologistName: psychologist.name,
      requestNumber:   request.requestNumber,
      studentName:     student.name,
      schoolName:      school.name,
      isSubstitute,
      substituteReason,
      requestId:       request._id.toString(),
    }),
  ])

  await writeAudit(session, {
    action: 'PSYCHOLOGIST_ASSIGNED',
    resource: 'CounselingRequest',
    resourceId: request._id.toString(),
    schoolId: request.schoolId?.toString(),
    details: { psychologistId, isSubstitute },
    req,
  })
    return NextResponse.json({ request, psychologist: { name: psychologist.name, isSubstitute } })
}
