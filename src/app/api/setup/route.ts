import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'

/**
 * POST /api/setup
 *
 * One-time bootstrap — creates the initial CITTAA_ADMIN.
 * Blocked after the first admin exists.
 *
 * Headers:
 *   x-setup-secret: <value of CRON_SECRET env var>
 *
 * Body:
 *   { "password": "YourChosenPassword" }
 *
 * Example (run once from Railway terminal or curl):
 *   curl -X POST https://cittaa-counselling-production.up.railway.app/api/setup \
 *     -H "Content-Type: application/json" \
 *     -H "x-setup-secret: <CRON_SECRET>" \
 *     -d '{"password":"Cittaa@2025"}'
 */
export async function POST(req: NextRequest) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()

  // ── Block if admin already exists ─────────────────────────────────────────
  const existingAdmin = await User.findOne({ role: 'CITTAA_ADMIN' })
  if (existingAdmin) {
    return NextResponse.json(
      { error: 'Setup already complete. An admin user already exists.' },
      { status: 409 }
    )
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const { password } = body

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL environment variable is not set.' },
      { status: 500 }
    )
  }

  // ── Create admin ──────────────────────────────────────────────────────────
  const admin = await User.create({
    name:         'Sairam (Cittaa Admin)',
    email:        adminEmail.toLowerCase(),
    passwordHash: password,           // pre-save hook hashes this
    role:         'CITTAA_ADMIN',
    isActive:     true,
    isAvailable:  true,
  })

  return NextResponse.json(
    {
      message: 'Setup complete! Admin user created.',
      email:   admin.email,
      role:    admin.role,
    },
    { status: 201 }
  )
}

/**
 * GET /api/setup — health check (tells you if setup is needed)
 */
export async function GET() {
  await connectDB()
  const adminExists = await User.exists({ role: 'CITTAA_ADMIN' })
  return NextResponse.json({
    setupRequired: !adminExists,
    message: adminExists
      ? 'System is configured. An admin already exists.'
      : 'No admin found. POST to /api/setup with x-setup-secret header to create one.',
  })
}
