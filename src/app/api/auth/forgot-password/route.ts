import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { sendPasswordResetEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://counseling.cittaa.in'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    await connectDB()

    // Always return success even if email not found — prevents user enumeration
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Generate reset token (valid for 1 hour)
    const resetToken       = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

    await User.findByIdAndUpdate(user._id, { resetToken, resetTokenExpiry })

    const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`

    await sendPasswordResetEmail({
      to:       user.email,
      name:     user.name,
      resetUrl,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[forgot-password]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
