import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    await connectDB()

    // Find user with valid (non-expired) token
    const user = await User.findOne({
      resetToken:       token,
      resetTokenExpiry: { $gt: new Date() },
      isActive:         true,
    }).select('+resetToken +resetTokenExpiry')

    if (!user) {
      return NextResponse.json(
        { error: 'This password reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Update password and clear token
    user.passwordHash     = newPassword   // pre-save hook will hash it
    user.resetToken       = undefined
    user.resetTokenExpiry = undefined
    await user.save()

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (err) {
    console.error('[reset-password]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
