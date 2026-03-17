import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Observation from '@/models/Observation'
import Student from '@/models/Student'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, id: userId, schoolId: userSchoolId } = session.user
  const { searchParams } = req.nextUrl
  const status    = searchParams.get('status')
  const page      = parseInt(searchParams.get('page')  || '1')
  const limit     = parseInt(searchParams.get('limit') || '50')
  const studentId = searchParams.get('studentId')

  const filter: any = {}
  if (['SCHOOL_PRINCIPAL','SCHOOL_ADMIN','CLASS_TEACHER','COORDINATOR'].includes(role)) {
    filter.schoolId = new mongoose.Types.ObjectId(userSchoolId!)
  } else if (role === 'PSYCHOLOGIST') {
    filter.conductedById = new mongoose.Types.ObjectId(userId)
  }
  if (status && status !== 'ALL') filter.status   = status
  if (studentId)                  filter.studentId = new mongoose.Types.ObjectId(studentId)

  const skip = (page - 1) * limit
  const [observations, total] = await Promise.all([
    Observation.find(filter)
      .populate('studentId',     'name rollNumber class section')
      .populate('conductedById', 'name email')
      .populate('sharedWith',    'name email role')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Observation.countDocuments(filter),
  ])

  return NextResponse.json({ observations, pagination: { total, page, limit, pages: Math.ceil(total / limit) } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, id: userId, schoolId: userSchoolId } = session.user
  if (!['CITTAA_ADMIN','CITTAA_SUPPORT','PSYCHOLOGIST'].includes(role)) {
    return NextResponse.json({ error: 'Only psychologists can record observations' }, { status: 403 })
  }

  await connectDB()

  const body = await req.json()
  const { studentId, classObserved, visitDate, behaviourFlags,
          observationNotes, recommendations, sharedWith, sharedWithEmails,
          recommendEscalation, isConfidential } = body

  if (!studentId || !classObserved || !visitDate) {
    return NextResponse.json({ error: 'studentId, classObserved and visitDate are required' }, { status: 400 })
  }

  let resolvedSchoolId = userSchoolId
  if (['CITTAA_ADMIN','CITTAA_SUPPORT'].includes(role)) {
    const stu = await Student.findById(studentId).select('schoolId').lean() as any
    resolvedSchoolId = stu?.schoolId?.toString()
  }
  if (!resolvedSchoolId) return NextResponse.json({ error: 'Could not determine school' }, { status: 400 })

  const obs = await Observation.create({
    studentId:        new mongoose.Types.ObjectId(studentId),
    schoolId:         new mongoose.Types.ObjectId(resolvedSchoolId),
    conductedById:    new mongoose.Types.ObjectId(userId),
    classObserved,
    visitDate:        new Date(visitDate),
    behaviourFlags:   behaviourFlags  || [],
    observationNotes: observationNotes || '',
    recommendations:  recommendations  || '',
    sharedWith:       (sharedWith || []).map((id: string) => new mongoose.Types.ObjectId(id)),
    sharedWithEmails: sharedWithEmails || [],
    recommendEscalation: !!recommendEscalation,
    isConfidential:   !!isConfidential,
    status:           'DRAFT',
  })

  const populated = await Observation.findById(obs._id)
    .populate('studentId',     'name rollNumber class section')
    .populate('conductedById', 'name email')
    .populate('sharedWith',    'name email role')
    .lean()

  return NextResponse.json({ observation: populated }, { status: 201 })
}
