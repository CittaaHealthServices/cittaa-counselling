import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Session from '@/models/Session'
import Assessment from '@/models/Assessment'
import RCIReport from '@/models/RCIReport'

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
  const { priority, isConfidential, description } = body

  // Only submitter or admin can edit
  const request = await CounselingRequest.findById(params.id)
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canEdit =
    session.user.role === 'CITTAA_ADMIN' ||
    request.submittedById.toString() === session.user.id

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
