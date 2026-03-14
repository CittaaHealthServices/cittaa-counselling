import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Student from '@/models/Student'       // must be imported so Mongoose registers the schema before .populate()
import Notification from '@/models/Notification'
import User from '@/models/User'
import { generateRequestNumber } from '@/lib/utils'
import { sendNewRequestEmail } from '@/lib/email'
import { maskStudentIfConfidential } from '@/lib/codename'
import { withErrorHandler } from '@/lib/monitor'
import mongoose from 'mongoose'

// ─── GET /api/requests — list with filters ────────────────────────────────────
export const GET = withErrorHandler(async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = req.nextUrl
  const page   = parseInt(searchParams.get('page')   || '1')
  const limit  = parseInt(searchParams.get('limit')  || '20')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search = searchParams.get('search')
  const schoolId = searchParams.get('schoolId')

  const filter: any = {}

  // Scope by role
  const { role, id: userId } = session.user
  if (role === 'CLASS_TEACHER' || role === 'COORDINATOR') {
    filter.submittedById = new mongoose.Types.ObjectId(userId)
    filter.schoolId = new mongoose.Types.ObjectId(session.user.schoolId!)
  } else if (role === 'SCHOOL_PRINCIPAL' || role === 'SCHOOL_ADMIN') {
    filter.schoolId = new mongoose.Types.ObjectId(session.user.schoolId!)
  } else if (role === 'PSYCHOLOGIST') {
    filter.assignedPsychologistId = new mongoose.Types.ObjectId(userId)
  } else if (role === 'RCI_TEAM') {
    // RCI sees requests with RCI-related statuses
    filter.status = { $in: ['RCI_NOTIFIED', 'RCI_VISITING', 'RCI_REPORT_SUBMITTED'] }
  }
  // CITTAA_ADMIN sees all

  if (status && status !== 'ALL') filter.status = status
  if (priority) filter.priority = priority
  if (schoolId && role === 'CITTAA_ADMIN') filter.schoolId = new mongoose.Types.ObjectId(schoolId)

  const skip = (page - 1) * limit
  const [requests, total] = await Promise.all([
    CounselingRequest.find(filter)
      .populate('studentId', 'name class section rollNumber codeName')
      .populate('schoolId', 'name code city')
      .populate('submittedById', 'name email role')
      .populate('assignedPsychologistId', 'name email')
      .populate('substitutePsychologistId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CounselingRequest.countDocuments(filter),
  ])

  // Apply confidentiality masking per request
  const viewerRole = session.user.role
  const maskedRequests = requests.map((r: any) => ({
    ...r,
    studentId: maskStudentIfConfidential(r.studentId, r.isConfidential, viewerRole),
  }))

  return NextResponse.json({
    requests: maskedRequests,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}, { route: '/api/requests' })

// ─── POST /api/requests — create new request ──────────────────────────────────
export const POST = withErrorHandler(async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = session.user
  if (!['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const body = await req.json()
  const { studentId, concernCategory, description, priority, isConfidential } = body

  if (!studentId || !concernCategory || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const requestNumber = generateRequestNumber()

  const request = await CounselingRequest.create({
    requestNumber,
    studentId,
    schoolId: session.user.schoolId,
    submittedById: session.user.id,
    concernCategory,
    description,
    priority: priority || 'MEDIUM',
    isConfidential: isConfidential || false,
    status: 'PENDING_APPROVAL',
    statusHistory: [{
      status: 'PENDING_APPROVAL',
      changedBy: session.user.id,
      note: 'Request submitted',
      timestamp: new Date(),
    }],
  })

  const populated = await CounselingRequest.findById(request._id)
    .populate('studentId', 'name class section')
    .populate('schoolId', 'name')
    .populate('submittedById', 'name email')
    .lean()

  // Notify principal(s) of this school
  const principals = await User.find({
    schoolId: session.user.schoolId,
    role: { $in: ['SCHOOL_PRINCIPAL'] },
    isActive: true,
  })

  // Create in-app notifications + send emails
  await Promise.all([
    ...principals.map((p) =>
      Notification.create({
        userId: p._id,
        title: 'New Counselling Request',
        message: `${(populated as any).submittedById.name} submitted a ${priority || 'MEDIUM'} priority request for ${(populated as any).studentId.name}`,
        type: 'NEW_REQUEST',
        link: `/dashboard/requests/${request._id}`,
        relatedId: request._id.toString(),
      })
    ),
    ...principals.map((p) =>
      sendNewRequestEmail({
        to: p.email,
        recipientName: p.name,
        requestNumber,
        studentName: (populated as any).studentId.name,
        concern: concernCategory,
        priority: priority || 'MEDIUM',
        schoolName: (populated as any).schoolId.name,
        submittedBy: (populated as any).submittedById.name,
        requestId: request._id.toString(),
      })
    ),
  ])

  return NextResponse.json({ request: populated }, { status: 201 })
}, { route: '/api/requests' })
