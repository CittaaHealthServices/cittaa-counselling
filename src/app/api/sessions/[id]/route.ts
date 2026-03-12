import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Session from '@/models/Session'
import CounselingRequest from '@/models/CounselingRequest'
import Notification from '@/models/Notification'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const body = await req.json()
  const { status, sessionReport, followUpRequired, nextSessionDate, notes } = body

  const existingSession = await Session.findById(params.id)
  if (!existingSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the assigned psychologist or admin can update
  const isAllowed =
    session.user.role === 'CITTAA_ADMIN' ||
    existingSession.psychologistId.toString() === session.user.id ||
    existingSession.substituteId?.toString() === session.user.id

  if (!isAllowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (status)           existingSession.status          = status
  if (sessionReport)    existingSession.sessionReport   = sessionReport
  if (notes)            existingSession.notes           = notes
  if (followUpRequired !== undefined) existingSession.followUpRequired = followUpRequired
  if (nextSessionDate)  existingSession.nextSessionDate = new Date(nextSessionDate)

  await existingSession.save()

  // If session completed, update request status
  if (status === 'COMPLETED') {
    const request = await CounselingRequest.findById(existingSession.requestId)
    if (request) {
      request.status = 'SESSION_COMPLETED' as any
      request.statusHistory.push({
        status: 'SESSION_COMPLETED',
        changedBy: session.user.id as any,
        note: 'Session completed by psychologist',
        timestamp: new Date(),
      })
      await request.save()

      // Notify school principal
      await Notification.create({
        userId: request.submittedById,
        title: 'Session Completed',
        message: `Counselling session for request ${request.requestNumber} has been completed`,
        type: 'SESSION_SCHEDULED',
        link: `/dashboard/requests/${request._id}`,
        relatedId: request._id.toString(),
      })
    }
  }

  return NextResponse.json({ session: existingSession })
}
