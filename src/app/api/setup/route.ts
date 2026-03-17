import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'

/**
 * POST /api/setup
 *
 * Creates the initial CITTAA_ADMIN, or resets the admin password if one exists.
 *
 * Headers:  x-setup-secret: <CRON_SECRET env var>
 * Body:     { "password": "NewPassword123", "force": true }
 *
 * curl example:
 *   curl -X POST https://app.cittaa.in/api/setup \
 *     -H "Content-Type: application/json" \
 *     -H "x-setup-secret: YOUR_CRON_SECRET" \
 *     -d '{"password":"Cittaa@2025","force":true}'
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()

  const body = await req.json().catch(() => ({}))
  const { password, force } = body

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  const existingAdmin = await User.findOne({ role: 'CITTAA_ADMIN' })

  // ── Reset existing admin password ─────────────────────────────────────────
  if (existingAdmin) {
    if (!force) {
      return NextResponse.json(
        { error: 'Admin already exists. Send { "force": true } to reset password.' },
        { status: 409 }
      )
    }
    existingAdmin.passwordHash = password   // pre-save hook re-hashes
    await existingAdmin.save()
    return NextResponse.json({
      message: 'Admin password reset successfully.',
      email: existingAdmin.email,
    })
  }

  // ── Create new admin ───────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL environment variable is not set.' },
      { status: 500 }
    )
  }

  const admin = await User.create({
    name:         'Sairam (Cittaa Admin)',
    email:        adminEmail.toLowerCase(),
    passwordHash: password,
    role:         'CITTAA_ADMIN',
    isActive:     true,
    isAvailable:  true,
  })

  return NextResponse.json(
    { message: 'Setup complete! Admin user created.', email: admin.email },
    { status: 201 }
  )
}

/**
 * GET /api/setup — check if setup is needed + show admin email
 */
export async function GET() {
  await connectDB()
  const admin = await User.findOne({ role: 'CITTAA_ADMIN' }).select('email name').lean() as any
  return NextResponse.json({
    setupRequired: !admin,
    adminEmail: admin?.email ?? null,
    adminName:  admin?.name  ?? null,
    message: admin
      ? `Admin exists: ${admin.email}`
      : 'No admin found. POST to /api/setup to create one.',
  })
}
