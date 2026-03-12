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

  const notifications = await Notification.find({
    userId: new mongoose.Types.ObjectId(session.user.id),
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  const unreadCount = await Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(session.user.id),
    isRead: false,
  })

  return NextResponse.json({ notifications, unreadCount })
}

// Mark notifications as read
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { ids, markAll } = await req.json()

  if (markAll) {
    await Notification.updateMany(
      { userId: new mongoose.Types.ObjectId(session.user.id), isRead: false },
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
