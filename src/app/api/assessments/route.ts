import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Assessment from '@/models/Assessment'
import CounselingRequest from '@/models/CounselingRequest'
import User from '@/models/User'
import Notification from '@/models/Notification'
import { sendAssessmentRequestEmail } from '@/lib/email'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const filter: any = {}
  const { role, schoolId } = session.user

  if (role === 'PSYCHOLOGIST') {
    filter.requestedById = new mongoose.Types.ObjectId(session.user.id)
  } else if (['SCHOOL_PRINCIPAL'].includes(role)) {
    const schoolRequests = await CounselingRequest.find(
      { schoolId: new mongoose.Types.ObjectId(schoolId!) }, '_id'
    ).lean()
    filter.requestId = { $in: schoolRequests.map((r: any) => r._id) }
  }
  // CITTAA_ADMIN & RCI_TEAM see all

  const status = req.nextUrl.searchParams.get('status')
  if (status) filter.status = status

  const assessments = await Assessment.find(filter)
    .populate('requestedById', 'name email')
    .populate('approvedById', 'name email')
    .populate({
      path: 'requestId',
      select: 'requestNumber priority status',
      populate: [
        { path: 'studentId', select: 'name class section' },
        { path: 'schoolId', select: 'name code city' },
      ],
    })
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ assessments })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'PSYCHOLOGIST') {
    return NextResponse.json({ error: 'Only psychologists can request assessments' }, { status: 403 })
  }

  await connectDB()

  const { requestId, sessionId, type, reason } = await req.json()

  const request = await CounselingRequest.findById(requestId)
    .populate('studentId', 'name')
    .populate('schoolId', 'name')

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const assessment = await Assessment.create({
    requestId,
    sessionId: sessionId || undefined,
    type,
    reason,
    status: 'PENDING_APPROVAL',
    requestedById: session.user.id,
  })

  // Update request status
  request.status = 'ASSESSMENT_REQUESTED' as any
  request.statusHistory.push({
    status: 'ASSESSMENT_REQUESTED',
    changedBy: session.user.id as any,
    note: `Assessment requested: ${type}`,
    timestamp: new Date(),
  })
  await request.save()

  const psychologist = await User.findById(session.user.id, 'name')

  // Notify principals and Cittaa admins for approval
  const approvers = await User.find({
    $or: [
      { schoolId: request.schoolId, role: 'SCHOOL_PRINCIPAL' },
      { role: 'CITTAA_ADMIN' },
    ],
    isActive: true,
  })

  await Promise.all([
    ...approvers.map((a) =>
      Notification.create({
        userId: a._id,
        title: 'Assessment Approval Required',
        message: `${psychologist?.name} has requested a ${type} assessment for ${(request.studentId as any).name}`,
        type: 'ASSESSMENT_REQUESTED',
        link: `/dashboard/assessments/${assessment._id}`,
        relatedId: assessment._id.toString(),
      })
    ),
    ...approvers.map((a) =>
      sendAssessmentRequestEmail({
        to: a.email,
        recipientName: a.name,
        requestNumber: request.requestNumber,
        studentName: (request.studentId as any).name,
        assessmentType: type,
        reason,
        psychologistName: psychologist?.name || 'Psychologist',
        assessmentId: assessment._id.toString(),
      })
    ),
  ])

  return NextResponse.json({ assessment }, { status: 201 })
}
