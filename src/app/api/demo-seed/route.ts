import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import School from '@/models/School'

/**
 * POST /api/demo-seed
 *
 * Creates / resets ALL demo accounts for the Cittaa showcase.
 * Protected by the same CRON_SECRET used for /api/setup.
 *
 * curl example:
 *   curl -X POST https://app.cittaa.in/api/demo-seed \
 *     -H "Content-Type: application/json" \
 *     -H "x-setup-secret: YOUR_CRON_SECRET" \
 *     -d '{}'
 */

export const dynamic = 'force-dynamic'

// ── Demo school ───────────────────────────────────────────────────────────────
const DEMO_SCHOOL = {
  name:       'Demo Public School',
  address:    '123 Demo Street, Hyderabad',
  city:       'Hyderabad',
  state:      'Telangana',
  pincode:    '500001',
  board:      'CBSE',
  isActive:   true,
}

// ── Demo users (password is plain-text; pre-save hook will bcrypt it) ─────────
const DEMO_PASSWORD = 'Cittaa@Demo1'

type DemoUser = {
  name: string
  email: string
  username?: string
  password: string
  role: string
  schoolKey?: string   // links to demo school
  isActive: boolean
  isAvailable?: boolean
}

const DEMO_USERS: DemoUser[] = [
  // ── Cittaa Staff ────────────────────────────────────────────────────────────
  {
    name:        'Sairam (Cittaa Admin)',
    email:       'admin@cittaa.in',
    password:    DEMO_PASSWORD,
    role:        'CITTAA_ADMIN',
    isActive:    true,
    isAvailable: true,
  },
  {
    name:        'Priya Support',
    email:       'support@cittaa.in',
    password:    DEMO_PASSWORD,
    role:        'CITTAA_SUPPORT',
    isActive:    true,
    isAvailable: true,
  },
  // ── Psychologist ────────────────────────────────────────────────────────────
  {
    name:        'Dr. Ananya Sharma',
    email:       'psychologist@cittaa.in',
    username:    'psychologist',
    password:    DEMO_PASSWORD,
    role:        'PSYCHOLOGIST',
    schoolKey:   'demo',
    isActive:    true,
    isAvailable: true,
  },
  // ── School Principal ────────────────────────────────────────────────────────
  {
    name:        'Mr. Rajesh Kumar',
    email:       'principal@demoschool.in',
    username:    'principal',
    password:    DEMO_PASSWORD,
    role:        'SCHOOL_PRINCIPAL',
    schoolKey:   'demo',
    isActive:    true,
  },
  // ── School Admin ────────────────────────────────────────────────────────────
  {
    name:        'Ms. Sunita Reddy',
    email:       'schooladmin@demoschool.in',
    username:    'schooladmin',
    password:    DEMO_PASSWORD,
    role:        'SCHOOL_ADMIN',
    schoolKey:   'demo',
    isActive:    true,
  },
  // ── Coordinator ────────────────────────────────────────────────────────────
  {
    name:        'Mr. Venkat Rao',
    email:       'coordinator@demoschool.in',
    username:    'coordinator',
    password:    DEMO_PASSWORD,
    role:        'COORDINATOR',
    schoolKey:   'demo',
    isActive:    true,
  },
  // ── Class Teacher ───────────────────────────────────────────────────────────
  {
    name:        'Ms. Lakshmi Devi',
    email:       'teacher@demoschool.in',
    username:    'teacher',
    password:    DEMO_PASSWORD,
    role:        'CLASS_TEACHER',
    schoolKey:   'demo',
    isActive:    true,
  },
]

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()

  // ── Upsert demo school ─────────────────────────────────────────────────────
  let school = await (School as any).findOne({ name: DEMO_SCHOOL.name })
  if (!school) {
    school = await (School as any).create(DEMO_SCHOOL)
  }
  const schoolId = school._id

  // ── Upsert each demo user ──────────────────────────────────────────────────
  const results: { email: string; status: string; role: string }[] = []

  for (const u of DEMO_USERS) {
    try {
      const existing = await User.findOne({ email: u.email.toLowerCase() })

      if (existing) {
        // Reset password and activate
        existing.passwordHash = u.password     // pre-save hook re-hashes
        existing.isActive     = true
        existing.name         = u.name
        if (u.username) existing.username = u.username
        if (u.schoolKey) existing.schoolId = schoolId
        await existing.save()
        results.push({ email: u.email, status: 'reset', role: u.role })
      } else {
        await User.create({
          name:         u.name,
          email:        u.email.toLowerCase(),
          passwordHash: u.password,
          role:         u.role,
          username:     u.username,
          schoolId:     u.schoolKey ? schoolId : undefined,
          isActive:     u.isActive,
          isAvailable:  u.isAvailable ?? false,
        })
        results.push({ email: u.email, status: 'created', role: u.role })
      }
    } catch (err: any) {
      results.push({ email: u.email, status: `error: ${err.message}`, role: u.role })
    }
  }

  return NextResponse.json({
    message:  'Demo accounts seeded successfully.',
    school:   { name: school.name, id: schoolId },
    password: DEMO_PASSWORD,
    accounts: results,
  })
}

/**
 * GET /api/demo-seed — list demo account emails (no auth needed for showcase)
 */
export async function GET() {
  return NextResponse.json({
    demoPassword: DEMO_PASSWORD,
    accounts: DEMO_USERS.map(u => ({
      name:  u.name,
      email: u.email,
      role:  u.role,
    })),
    note: 'POST with x-setup-secret header to create/reset these accounts.',
  })
}
