import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Observation from '@/models/Observation'
import CounselingRequest from '@/models/CounselingRequest'
import Notification from '@/models/Notification'
import User from '@/models/User'
import { generateRequestNumber } from '@/lib/utils'
import { sendObservationEscalatedEmail } from '@/lib/email-observations'

// ─── GET /api/observations/[id] ───────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const obs = await Observation.findById(params.id)
    .populate('studentId',            'name class section rollNumber age gender parentName parentPhone')
    .populate('schoolId',             'name city state')
    .populate('psychologistId',       'name email phone')
    .populate('sharedWithId',         'name email role')
    .populate('reviewedById',         'name email role')
    .populate('counsellingRequestId', 'requestNumber status')
    .lean()

  if (!obs) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ observation: obs })
}

// ─── PATCH /api/observations/[id] — various actions ──────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const body = await req.json()
  const { action } = body
  // action: 'share' | 'acknowledge' | 'escalate' | 'decline' | 'update'

  const obs = await Observation.findById(params.id)
    .populate('studentId',      'name class section')
    .populate('psychologistId', 'name email')
    .populate('schoolId',       'name')

  if (!obs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = session.user.role

  // ── SHARE (psychologist shares a draft with a teacher/coordinator) ──────────
  if (action === 'share') {
    if (role !== 'PSYCHOLOGIST') return NextResponse.json({ error: 'Only psychologists can share observations' }, { status: 403 })
    if (obs.status !== 'DRAFT')  return NextResponse.json({ error: 'Only draft observations can be shared' }, { status: 400 })

    const { sharedWithId } = body
    if (!sharedWithId) return NextResponse.json({ error: 'Provide sharedWithId' }, { status: 400 })

    obs.sharedWithId = sharedWithId
    obs.sharedAt     = new Date()
    obs.status       = 'SHARED'
    await obs.save()

    // Notify the teacher
    const teacher = await User.findById(sharedWithId)
    if (teacher) {
      const student = obs.studentId as any
      const psych   = obs.psychologistId as any
      await Promise.all([
        Notification.create({
          userId:    sharedWithId,
          title:     'Classroom Observation Shared With You',
          message:   `${psych.name} shared observation notes for ${student.name}. Please review.`,
          type:      'NEW_REQUEST',
          link:      `/dashboard/observations/${obs._id}`,
          relatedId: obs._id.toString(),
        }),
        (await import('@/lib/email-observations')).sendObservationSharedEmail({
          to:                  teacher.email,
          teacherName:         teacher.name,
          psychologistName:    psych.name,
          studentName:         student.name,
          studentClass:        `${student.class}${student.section ? ` – ${student.section}` : ''}`,
          classVisitDate:      new Date(obs.classVisitDate).toLocaleDateString('en-IN'),
          classObserved:       obs.classObserved,
          behaviourFlags:      obs.behaviourFlags || [],
          recommendEscalation: obs.recommendEscalation,
          observationId:       obs._id.toString(),
        }),
      ])
    }

    return NextResponse.json({ observation: obs })
  }

  // ── ACKNOWLEDGE (teacher reviewed, no escalation) ───────────────────────────
  if (action === 'acknowledge') {
    if (!['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (obs.status !== 'SHARED') return NextResponse.json({ error: 'Observation is not pending review' }, { status: 400 })

    obs.status      = 'ACKNOWLEDGED'
    obs.reviewedById = session.user.id as any
    obs.reviewNote  = body.reviewNote || 'Acknowledged — no escalation needed'
    obs.reviewedAt  = new Date()
    await obs.save()

    // Notify psychologist
    const psych = obs.psychologistId as any
    await Notification.create({
      userId:    psych._id || psych,
      title:     'Observation Acknowledged',
      message:   `Your observation for ${(obs.studentId as any).name} was acknowledged. No counselling session will be created.`,
      type:      'GENERAL',
      link:      `/dashboard/observations/${obs._id}`,
      relatedId: obs._id.toString(),
    })

    return NextResponse.json({ observation: obs })
  }

  // ── ESCALATE (teacher approves → auto-creates CounselingRequest) ────────────
  if (action === 'escalate') {
    if (!['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (obs.status !== 'SHARED') return NextResponse.json({ error: 'Observation is not pending review' }, { status: 400 })

    const { reviewNote, priority } = body
    const student = obs.studentId as any
    const psych   = obs.psychologistId as any
    const school  = obs.schoolId as any

    // Auto-create CounselingRequest
    const requestNumber = generateRequestNumber()
    const counsellingReq = await CounselingRequest.create({
      requestNumber,
      studentId:     student._id,
      schoolId:      obs.schoolId,
      submittedById: session.user.id,      // teacher who approved escalation
      concernCategory: 'Other',            // psychologist can update via their dashboard
      description: `[Escalated from classroom observation by ${psych.name} on ${new Date(obs.classVisitDate).toLocaleDateString('en-IN')}]\n\n${obs.observations}`,
      priority:    priority || 'MEDIUM',
      isConfidential: false,
      status: 'APPROVED',                 // Skip PENDING_APPROVAL – teacher IS the approver here
      approvedById: session.user.id,
      // Pre-assign the psychologist who observed
      assignedPsychologistId: psych._id || psych,
      statusHistory: [
        {
          status:    'PENDING_APPROVAL',
          changedBy: session.user.id,
          note:      'Auto-created from classroom observation',
          timestamp: new Date(),
        },
        {
          status:    'APPROVED',
          changedBy: session.user.id,
          note:      `Approved by ${session.user.role === 'SCHOOL_PRINCIPAL' ? 'Principal' : 'Teacher/Coordinator'}: ${reviewNote || ''}`,
          timestamp: new Date(),
        },
        {
          status:    'PSYCHOLOGIST_ASSIGNED',
          changedBy: session.user.id,
          note:      `Psychologist ${psych.name} pre-assigned (original observer)`,
          timestamp: new Date(),
        },
      ],
    })

    // Update observation
    obs.status              = 'ESCALATED'
    obs.reviewedById        = session.user.id as any
    obs.reviewNote          = reviewNote || 'Escalated to counselling'
    obs.reviewedAt          = new Date()
    obs.counsellingRequestId = counsellingReq._id
    await obs.save()

    // Get teacher for email
    const teacher = await User.findById(session.user.id)

    // Notify psychologist + send email
    await Promise.all([
      Notification.create({
        userId:    psych._id || psych,
        title:     'Observation Escalated — New Counselling Request',
        message:   `${teacher?.name} approved escalation for ${student.name}. Request ${requestNumber} created. You are pre-assigned.`,
        type:      'REQUEST_APPROVED',
        link:      `/dashboard/requests/${counsellingReq._id}`,
        relatedId: counsellingReq._id.toString(),
      }),
      // Also notify Cittaa admins
      User.find({ role: 'CITTAA_ADMIN', isActive: true }).then((admins) =>
        Promise.all(admins.map((a) =>
          Notification.create({
            userId:    a._id,
            title:     'Request Created via Observation Escalation',
            message:   `${school.name}: ${teacher?.name} escalated ${psych.name}'s observation for ${student.name}.`,
            type:      'NEW_REQUEST',
            link:      `/dashboard/requests/${counsellingReq._id}`,
            relatedId: counsellingReq._id.toString(),
          })
        ))
      ),
      sendObservationEscalatedEmail({
        toPsychologist:   psych.email,
        psychologistName: psych.name,
        teacherName:      teacher?.name || 'Teacher',
        studentName:      student.name,
        requestNumber,
        requestId:        counsellingReq._id.toString(),
      }),
    ])

    return NextResponse.json({
      observation: obs,
      counsellingRequest: { _id: counsellingReq._id, requestNumber },
    })
  }

  // ── DECLINE (teacher declines escalation with reason) ───────────────────────
  if (action === 'decline') {
    if (!['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    obs.status       = 'DECLINED'
    obs.reviewedById = session.user.id as any
    obs.reviewNote   = body.reviewNote || 'Declined by teacher'
    obs.reviewedAt   = new Date()
    await obs.save()

    const psych = obs.psychologistId as any
    await Notification.create({
      userId:    psych._id || psych,
      title:     'Observation Declined',
      message:   `Your observation for ${(obs.studentId as any).name} was declined. Reason: ${body.reviewNote || 'No reason provided'}`,
      type:      'GENERAL',
      link:      `/dashboard/observations/${obs._id}`,
      relatedId: obs._id.toString(),
    })

    return NextResponse.json({ observation: obs })
  }

  // ── UPDATE (psychologist edits a draft) ────────────────────────────────────
  if (action === 'update') {
    if (role !== 'PSYCHOLOGIST' || obs.psychologistId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (obs.status !== 'DRAFT') return NextResponse.json({ error: 'Cannot edit a shared observation' }, { status: 400 })

    const { observations: notes, behaviourFlags, recommendEscalation, classObserved, classVisitDate } = body
    if (notes)              obs.observations        = notes
    if (behaviourFlags)     obs.behaviourFlags       = behaviourFlags
    if (recommendEscalation !== undefined) obs.recommendEscalation = recommendEscalation
    if (classObserved)      obs.classObserved        = classObserved
    if (classVisitDate)     obs.classVisitDate       = new Date(classVisitDate)

    await obs.save()
    return NextResponse.json({ observation: obs })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
