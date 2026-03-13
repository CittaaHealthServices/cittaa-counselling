import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Notification from '@/models/Notification'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const searchParams = req.nextUrl.searchParams
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit  = Math.min(50, parseInt(searchParams.get('limit') || '20'))
  const unreadOnly = searchParams.get('unread') === 'true'
  const skip   = (page - 1) * limit

  const filter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(session.user.id),
  }
  if (unreadOnly) filter.isRead = false

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ])

  const unreadCount = unreadOnly ? total : await Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(session.user.id),
    isRead: false,
  })

  return NextResponse.json({
    notifications,
    unreadCount,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}

// Mark notifications as read
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { ids, markAll, notificationId } = await req.json()

  if (markAll) {
    await Notification.updateMany(
      { userId: new mongoose.Types.ObjectId(session.user.id), isRead: false },
      { $set: { isRead: true } }
    )
  } else if (notificationId) {
    await Notification.updateOne(
      { _id: notificationId, userId: new mongoose.Types.ObjectId(session.user.id) },
      { $set: { isRead: true } }
    )
  } else if (Array.isArray(ids)) {
    await Notification.updateMany(
      { _id: { $in: ids }, userId: new mongoose.Types.ObjectId(session.user.id) },
      { $set: { isRead: true } }
    )
  }

  return NextResponse.json({ success: true })
}
