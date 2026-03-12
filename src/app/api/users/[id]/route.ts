import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

// PATCH — update user (availability, active, profile)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const body = await req.json()

  const targetUser = await User.findById(params.id)
  if (!targetUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isSelf  = session.user.id === params.id
  const isAdmin = session.user.role === 'CITTAA_ADMIN'
  const isPrincipal = session.user.role === 'SCHOOL_PRINCIPAL' &&
    targetUser.schoolId?.toString() === session.user.schoolId

  if (!isSelf && !isAdmin && !isPrincipal) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fields anyone can update about themselves
  if (isSelf) {
    if (body.name)  targetUser.name  = body.name
    if (body.phone) targetUser.phone = body.phone
    if (body.profilePhoto) targetUser.profilePhoto = body.profilePhoto

    // Change password
    if (body.currentPassword && body.newPassword) {
      const valid = await targetUser.verifyPassword(body.currentPassword)
      if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      targetUser.passwordHash = body.newPassword  // pre-save hook hashes it
    }

    // Psychologist availability toggle
    if (session.user.role === 'PSYCHOLOGIST' && body.isAvailable !== undefined) {
      targetUser.isAvailable = body.isAvailable
    }
  }

  // Admin/principal can also toggle isActive
  if ((isAdmin || isPrincipal) && body.isActive !== undefined) {
    targetUser.isActive = body.isActive
  }
  if (isAdmin && body.isAvailable !== undefined) {
    targetUser.isAvailable = body.isAvailable
  }

  await targetUser.save()

  const updated = await User.findById(params.id)
    .populate('schoolId', 'name code')
    .select('-passwordHash')
    .lean()

  return NextResponse.json({ user: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['CITTAA_ADMIN', 'SCHOOL_PRINCIPAL'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()

  // Soft delete
  await User.findByIdAndUpdate(params.id, { isActive: false })
  return NextResponse.json({ success: true })
}
