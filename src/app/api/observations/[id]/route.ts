import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Observation from '@/models/Observation'
import CounselingRequest from '@/models/CounselingRequest'
import Student from '@/models/Student'
import { withErrorHandler } from '@/lib/monitor'
import { sendObservationSharedEmail, sendObservationEscalatedEmail } from '@/lib/email-observations'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

const populate = (q: any) =>
  q.populate('studentId',         'name rollNumber class section gender')
   .populate('conductedById',     'name email')
   .populate('sharedWith',        'name email role')
   .populate('escalatedRequestId','requestNumber status')

export const GET = withErrorHandler(async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const obs = await populate(Observation.findById(params.id)).lean()
  if (!obs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { role, id: userId, schoolId } = session.user
  if (['SCHOOL_PRINCIPAL','SCHOOL_ADMIN','CLASS_TEACHER','COORDINATOR'].includes(role)) {
    if ((obs as any).schoolId?.toString() !== schoolId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (role === 'PSYCHOLOGIST') {
    const isAuthor = (obs as any).conductedById?._id?.toString() === userId
    const isShared = (obs as any).sharedWith?.some((u: any) => u._id?.toString() === userId)
    if (!isAuthor && !isShared)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ observation: obs })
}, { route: '/api/observations/[id]' })

export const PATCH = withErrorHandler(async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const obs = await populate(Observation.findById(params.id))
  if (!obs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { role, id: userId } = session.user
  const body = await req.json()
  const { action, ...fields } = body

  // ── recommend ────────────────────────────────────────────────────────────────
  if (action === 'recommend') {
    if (obs.status !== 'DRAFT')
      return NextResponse.json({ error: 'Only DRAFT observations can be recommended' }, { status: 400 })
    if (role === 'PSYCHOLOGIST' && (obs as any).conductedById?._id?.toString() !== userId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    obs.status              = 'AWAITING_REVIEW'
    obs.recommendEscalation = true
    if (fields.observationNotes !== undefined) obs.observationNotes = fields.observationNotes
    if (fields.recommendations   !== undefined) obs.recommendations  = fields.recommendations
    if (Array.isArray(fields.sharedWith) && fields.sharedWith.length)
      obs.sharedWith = fields.sharedWith.map((id: string) => new mongoose.Types.ObjectId(id))
    if (Array.isArray(fields.sharedWithEmails) && fields.sharedWithEmails.length)
      obs.sharedWithEmails = fields.sharedWithEmails

    await obs.save()

    const student = (obs as any).studentId
    const psych   = (obs as any).conductedById
    await Promise.allSettled(
      (obs.sharedWithEmails || []).map((email: string) =>
        sendObservationSharedEmail({
          to:                  email,
          teacherName:         email,
          psychologistName:    psych?.name  ?? 'Your Psychologist',
          studentName:         student?.name ?? 'Student',
          studentClass:        `${student?.class ?? ''} ${student?.section ?? ''}`.trim(),
          classVisitDate:      new Date(obs.visitDate).toLocaleDateString('en-IN'),
          classObserved:       obs.classObserved,
          behaviourFlags:      obs.behaviourFlags,
          recommendEscalation: true,
          observationId:       obs._id.toString(),
        })
      )
    )

    return NextResponse.json({ observation: await populate(Observation.findById(params.id)).lean() })
  }

  // ── escalate ─────────────────────────────────────────────────────────────────
  if (action === 'escalate') {
    if (!['AWAITING_REVIEW','DRAFT'].includes(obs.status))
      return NextResponse.json({ error: `Cannot escalate from ${obs.status}` }, { status: 400 })

    const student = (obs as any).studentId
    if (!student?._id) return NextResponse.json({ error: 'Student data missing' }, { status: 400 })

    const count  = await CounselingRequest.countDocuments()
    const reqNum = `CR-${String(count + 1).padStart(4, '0')}`
    const isHigh = obs.behaviourFlags.some((f: string) =>
      ['Suicidal ideation','Self-harm','Extreme aggression'].includes(f))

    const cr = await CounselingRequest.create({
      studentId:        student._id,
      schoolId:         obs.schoolId,
      requestNumber:    reqNum,
      source:           'OBSERVATION_ESCALATION',
      observationId:    obs._id,
      status:           'PENDING_APPROVAL',
      priority:         isHigh ? 'HIGH' : 'MEDIUM',
      issueDescription: `Escalated from classroom observation.\nBehaviour flags: ${obs.behaviourFlags.join(', ')}.\n${obs.recommendations}`,
      submittedBy:      new mongoose.Types.ObjectId(userId),
      assignedTo:       (obs as any).conductedById?._id,
    })

    obs.status             = 'ESCALATED'
    obs.escalatedRequestId = cr._id as any
    if (fields.teacherResponse) obs.teacherResponse = fields.teacherResponse
    await obs.save()

    const psych = (obs as any).conductedById
    if (psych?.email) {
      await sendObservationEscalatedEmail({
        toPsychologist:   psych.email,
        psychologistName: psych.name ?? 'Psychologist',
        teacherName:      session.user.name ?? 'Teacher',
        studentName:      student.name ?? 'Student',
        requestNumber:    reqNum,
        requestId:        cr._id.toString(),
      }).catch(() => {})
    }

    return NextResponse.json({
      observation:       await populate(Observation.findById(params.id)).lean(),
      counselingRequest: cr,
    })
  }

  // ── acknowledge ───────────────────────────────────────────────────────────────
  if (action === 'acknowledge') {
    obs.status = 'ACKNOWLEDGED'
    if (fields.teacherResponse) obs.teacherResponse = fields.teacherResponse
    await obs.save()
    return NextResponse.json({ observation: await populate(Observation.findById(params.id)).lean() })
  }

  // ── decline ───────────────────────────────────────────────────────────────────
  if (action === 'decline') {
    obs.status        = 'DECLINED'
    obs.declineReason = fields.declineReason || ''
    if (fields.teacherResponse) obs.teacherResponse = fields.teacherResponse
    await obs.save()
    return NextResponse.json({ observation: await populate(Observation.findById(params.id)).lean() })
  }

  // ── general edit (DRAFT only) ─────────────────────────────────────────────────
  if (obs.status !== 'DRAFT')
    return NextResponse.json({ error: 'Only DRAFT observations can be edited' }, { status: 400 })
  if (role === 'PSYCHOLOGIST' && (obs as any).conductedById?._id?.toString() !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const EDITABLE = ['classObserved','visitDate','behaviourFlags','observationNotes',
                    'recommendations','sharedWith','sharedWithEmails','recommendEscalation','isConfidential']
  for (const key of EDITABLE) {
    if (fields[key] === undefined) continue
    if (key === 'visitDate') (obs as any)[key] = new Date(fields[key])
    else if (key === 'sharedWith') (obs as any)[key] = (fields[key] as string[]).map((id: string) => new mongoose.Types.ObjectId(id))
    else (obs as any)[key] = fields[key]
  }
  await obs.save()
  return NextResponse.json({ observation: await populate(Observation.findById(params.id)).lean() })
}, { route: '/api/observations/[id]' })

export const DELETE = withErrorHandler(async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const obs = await Observation.findById(params.id)
  if (!obs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { role, id: userId } = session.user
  const isOwner = obs.conductedById?.toString() === userId
  const isAdmin = ['CITTAA_ADMIN','CITTAA_SUPPORT'].includes(role)
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (obs.status === 'ESCALATED') return NextResponse.json({ error: 'Cannot delete escalated observation' }, { status: 400 })

  await obs.deleteOne()
  return NextResponse.json({ success: true })
}, { route: '/api/observations/[id]' })
