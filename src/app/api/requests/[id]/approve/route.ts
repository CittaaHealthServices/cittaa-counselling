import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Notification from '@/models/Notification'
import User from '@/models/User'
import { sendRequestApprovedEmail, sendRequestRejectedEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = session.user
  if (!['SCHOOL_PRINCIPAL', 'CITTAA_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const { action, reason } = await req.json() // action: 'approve' | 'reject'

  const request = await CounselingRequest.findById(params.id)
    .populate('studentId', 'name')
    .populate('submittedById', 'name email')
    .populate('schoolId', 'name')

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Request is not pending approval' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
  request.status = newStatus as any
  request.approvedById = session.user.id as any
  if (action === 'reject' && reason) request.rejectionReason = reason

  request.statusHistory.push({
    status: newStatus as any,
    changedBy: session.user.id as any,
    note: action === 'approve' ? 'Approved by principal' : `Rejected: ${reason || 'No reason given'}`,
    timestamp: new Date(),
  })

  await request.save()

  // Notify the submitter
  const submitter = request.submittedById as any
  await Promise.all([
    Notification.create({
      userId: submitter._id,
      title: action === 'approve' ? 'Request Approved' : 'Request Rejected',
      message: action === 'approve'
        ? `Your request for ${(request.studentId as any).name} has been approved`
        : `Your request for ${(request.studentId as any).name} was rejected: ${reason || ''}`,
      type: action === 'approve' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
      link: `/dashboard/requests/${request._id}`,
      relatedId: request._id.toString(),
    }),
    action === 'approve'
      ? sendRequestApprovedEmail({
          to: submitter.email,
          recipientName: submitter.name,
          requestNumber: request.requestNumber,
          studentName: (request.studentId as any).name,
          requestId: request._id.toString(),
        })
      : sendRequestRejectedEmail({
          to: submitter.email,
          recipientName: submitter.name,
          requestNumber: request.requestNumber,
          studentName: (request.studentId as any).name,
          reason: reason || 'No reason provided',
          requestId: request._id.toString(),
        }),

    // If approved, also notify Cittaa admin to assign psychologist
    action === 'approve'
      ? User.find({ role: 'CITTAA_ADMIN', isActive: true }).then((admins) =>
          Promise.all(admins.map((a) =>
            Notification.create({
              userId: a._id,
              title: 'Request Approved – Assign Psychologist',
              message: `${(request.schoolId as any).name} approved a request for ${(request.studentId as any).name}. Please assign a psychologist.`,
              type: 'REQUEST_APPROVED',
              link: `/dashboard/requests/${request._id}`,
              relatedId: request._id.toString(),
            })
          ))
        )
      : Promise.resolve(),
  ])

  return NextResponse.json({ request })
}
