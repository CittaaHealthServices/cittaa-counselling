import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Observation from '@/models/Observation'
import mongoose from 'mongoose'

// ─── GET /api/observations ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, id: userId, schoolId } = session.user
  const { searchParams } = req.nextUrl

  const filter: any = {}
  const status = searchParams.get('status')
  const wantsStats = searchParams.get('stats') === 'true'

  if (role === 'PSYCHOLOGIST') {
    filter.psychologistId = new mongoose.Types.ObjectId(userId)
  } else if (['CLASS_TEACHER', 'COORDINATOR'].includes(role)) {
    filter.sharedWithId = new mongoose.Types.ObjectId(userId)
    filter.status = { $in: ['SHARED', 'ACKNOWLEDGED', 'ESCALATED', 'DECLINED'] }
  } else if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)) {
    filter.schoolId = new mongoose.Types.ObjectId(schoolId!)
  } else if (['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)) {
    const filterSchool = searchParams.get('schoolId')
    if (filterSchool) filter.schoolId = new mongoose.Types.ObjectId(filterSchool)
  } else {
    return NextResponse.json({ observations: [] })
  }

  // Optional status filter (override for non-teacher roles)
  if (status && status !== 'ALL' && !['CLASS_TEACHER', 'COORDINATOR'].includes(role)) {
    filter.status = status
  }

  // Class / section filter (principal / psychologist can filter by class)
  const classFilter = searchParams.get('class')
  const sectionFilter = searchParams.get('section')
  if (classFilter || sectionFilter) {
    const Student = (await import('@/models/Student')).default
    const studentQuery: any = { schoolId: filter.schoolId }
    if (classFilter) studentQuery.class = classFilter
    if (sectionFilter) studentQuery.section = sectionFilter
    const studentIds = await Student.find(studentQuery).distinct('_id')
    filter.studentId = { $in: studentIds }
  }

  // ── Stats aggregation for principal / admin ───────────────────────────────
  if (wantsStats && ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)) {
    const [statusCounts, perPsychologist, recentActivity] = await Promise.all([
      // Status breakdown
      Observation.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Per-psychologist summary
      Observation.aggregate([
        { $match: { ...filter, status: { $ne: 'DRAFT' } } }, // shared+
        { $group: {
          _id: '$psychologistId',
          total:        { $sum: 1 },
          escalated:    { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED'] }, 1, 0] } },
          acknowledged: { $sum: { $cond: [{ $eq: ['$status', 'ACKNOWLEDGED'] }, 1, 0] } },
          pending:      { $sum: { $cond: [{ $eq: ['$status', 'SHARED'] }, 1, 0] } },
          declined:     { $sum: { $cond: [{ $eq: ['$status', 'DECLINED'] }, 1, 0] } },
          lastActivity: { $max: '$createdAt' },
        }},
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'psychologist' } },
        { $unwind: { path: '$psychologist', preserveNullAndEmptyArrays: true } },
        { $project: {
          psychologistName: '$psychologist.name',
          psychologistEmail: '$psychologist.email',
          total: 1, escalated: 1, acknowledged: 1, pending: 1, declined: 1, lastActivity: 1,
        }},
        { $sort: { total: -1 } },
      ]),

      // Recent 7-day trend
      Observation.aggregate([
        { $match: {
          ...filter,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }},
        { $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' },
          },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
    ])

    const statusMap = Object.fromEntries(statusCounts.map((s: any) => [s._id, s.count]))
    return NextResponse.json({
      stats: {
        total:        Object.values(statusMap).reduce((a: any, b: any) => a + b, 0),
        draft:        statusMap.DRAFT        || 0,
        shared:       statusMap.SHARED       || 0,
        acknowledged: statusMap.ACKNOWLEDGED || 0,
        escalated:    statusMap.ESCALATED    || 0,
        declined:     statusMap.DECLINED     || 0,
        perPsychologist,
        recentActivity,
      },
    })
  }

  const page  = parseInt(searchParams.get('page')  || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip  = (page - 1) * limit

  const [observations, total] = await Promise.all([
    Observation.find(filter)
      .populate('studentId',          'name class section rollNumber')
      .populate('schoolId',           'name code')
      .populate('psychologistId',     'name email')
      .populate('sharedWithId',       'name email role')
      .populate('reviewedById',       'name email')
      .populate('counsellingRequestId', 'requestNumber status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Observation.countDocuments(filter),
  ])

  return NextResponse.json({
    observations,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}

// ─── POST /api/observations — psychologist creates a new observation ──────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'PSYCHOLOGIST') {
    return NextResponse.json({ error: 'Only psychologists can create observations' }, { status: 403 })
  }

  await connectDB()

  const {
    // Existing student by ID
    studentId,
    // Manual student entry (when student not yet in system)
    manualStudentName,
    manualStudentClass,
    manualStudentSection,
    // Observation fields
    classVisitDate, classObserved, observations,
    behaviourFlags, recommendEscalation,
    sharedWithId,   // optional — if provided, immediately shares
  } = await req.json()

  if ((!studentId && !manualStudentName) || !classObserved || !observations) {
    return NextResponse.json({ error: 'Student and observation details are required' }, { status: 400 })
  }

  const Student = (await import('@/models/Student')).default
  let resolvedStudentId = studentId
  let resolvedSchoolId  = session.user.schoolId

  if (studentId) {
    const student = await Student.findById(studentId).lean() as any
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    resolvedSchoolId = student.schoolId
  } else {
    // Manual entry: create or find the student for this school
    if (!manualStudentClass) {
      return NextResponse.json({ error: 'Class is required for manual student entry' }, { status: 400 })
    }
    // Try to find existing student with same name + class in school
    const existing = await Student.findOne({
      name:    { $regex: new RegExp(`^${manualStudentName.trim()}$`, 'i') },
      class:   manualStudentClass,
      section: manualStudentSection || undefined,
      schoolId: new mongoose.Types.ObjectId(resolvedSchoolId!),
    }).lean() as any

    if (existing) {
      resolvedStudentId = existing._id
    } else {
      // Create a new student record
      const newStudent = await Student.create({
        name:     manualStudentName.trim(),
        class:    manualStudentClass,
        section:  manualStudentSection || undefined,
        schoolId: new mongoose.Types.ObjectId(resolvedSchoolId!),
        // No rollNumber — can be filled in later
      })
      resolvedStudentId = newStudent._id
    }
  }

  const status = sharedWithId ? 'SHARED' : 'DRAFT'

  const obs = await Observation.create({
    studentId:           resolvedStudentId,
    schoolId:            resolvedSchoolId,
    psychologistId:      session.user.id,
    classVisitDate:      classVisitDate ? new Date(classVisitDate) : new Date(),
    classObserved,
    observations,
    behaviourFlags:      behaviourFlags || [],
    recommendEscalation: recommendEscalation || false,
    sharedWithId:        sharedWithId || undefined,
    sharedAt:            sharedWithId ? new Date() : undefined,
    status,
  })

  // If shared immediately — send notification + email
  if (sharedWithId) {
    await notifyTeacher(obs._id.toString(), sharedWithId)
  }

  const populated = await Observation.findById(obs._id)
    .populate('studentId',      'name class section')
    .populate('psychologistId', 'name')
    .populate('sharedWithId',   'name email')
    .lean()

  return NextResponse.json({ observation: populated }, { status: 201 })
}

// Helper: create in-app notification and send email to the teacher
async function notifyTeacher(obsId: string, teacherId: string) {
  const [Notification, User, ObsModel] = await Promise.all([
    import('@/models/Notification').then((m) => m.default),
    import('@/models/User').then((m) => m.default),
    import('@/models/Observation').then((m) => m.default),
  ])
  const { sendObservationSharedEmail } = await import('@/lib/email-observations')

  const obs = await ObsModel.findById(obsId)
    .populate('studentId',      'name class section')
    .populate('psychologistId', 'name email')
    .lean() as any

  const teacher = await User.findById(teacherId).lean() as any
  if (!obs || !teacher) return

  await Promise.all([
    Notification.create({
      userId:    teacherId,
      title:     'Classroom Observation Shared',
      message:   `${obs.psychologistId.name} has shared observation notes for ${obs.studentId.name}. Your review is needed.`,
      type:      'NEW_REQUEST',
      link:      `/dashboard/observations/${obsId}`,
      relatedId: obsId,
    }),
    sendObservationSharedEmail({
      to:                  teacher.email,
      teacherName:         teacher.name,
      psychologistName:    obs.psychologistId.name,
      studentName:         obs.studentId.name,
      studentClass:        `${obs.studentId.class}${obs.studentId.section ? ` – ${obs.studentId.section}` : ''}`,
      classVisitDate:      new Date(obs.classVisitDate).toLocaleDateString('en-IN'),
      classObserved:       obs.classObserved,
      behaviourFlags:      obs.behaviourFlags || [],
      recommendEscalation: obs.recommendEscalation,
      observationId:       obsId,
    }),
  ])
}
