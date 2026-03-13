import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import School from '@/models/School'
import User from '@/models/User'
import CounselingRequest from '@/models/CounselingRequest'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const sp     = req.nextUrl.searchParams
  const page   = Math.max(1, parseInt(sp.get('page')  || '1'))
  const limit  = Math.min(500, parseInt(sp.get('limit') || '20'))   // 500 max for dropdown use-cases
  const search = sp.get('search') || ''
  const skip   = (page - 1) * limit

  const query: any = { isActive: true }
  if (search) {
    query.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { city:  { $regex: search, $options: 'i' } },
      { code:  { $regex: search, $options: 'i' } },
      { state: { $regex: search, $options: 'i' } },
    ]
  }

  const [schools, total] = await Promise.all([
    School.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    School.countDocuments(query),
  ])

  // Add case counts for Cittaa admin/support
  if (['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(session.user.role)) {
    const schoolsWithStats = await Promise.all(
      schools.map(async (s: any) => {
        const [totalCases, activeCases, urgentCases] = await Promise.all([
          CounselingRequest.countDocuments({ schoolId: s._id }),
          CounselingRequest.countDocuments({ schoolId: s._id, status: { $ne: 'CLOSED' } }),
          CounselingRequest.countDocuments({ schoolId: s._id, priority: 'URGENT', status: { $ne: 'CLOSED' } }),
        ])
        return { ...s, totalCases, activeCases, urgentCases }
      })
    )
    return NextResponse.json({
      schools: schoolsWithStats,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  }

  return NextResponse.json({
    schools,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'CITTAA_ADMIN') {
    return NextResponse.json({ error: 'Only Cittaa Admin can add schools' }, { status: 403 })
  }

  await connectDB()

  const body = await req.json()
  const {
    name, address, city, state, pincode, phone, email,
    principalName, principalEmail, principalPhone,
  } = body

  // Validate required fields
  if (!name || !city || !state) {
    return NextResponse.json({ error: 'School name, city and state are required' }, { status: 400 })
  }

  // Auto-generate code if not supplied
  let code = (body.code || '').trim().toUpperCase()
  if (!code) {
    const initials = name
      .split(/\s+/)
      .map((w: string) => w[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 5)
    const suffix = Date.now().toString().slice(-4)
    code = `${initials}-${suffix}`
  }

  // Ensure code uniqueness
  const existing = await School.findOne({ code })
  if (existing) {
    code = `${code}-${Date.now().toString().slice(-4)}`
  }

  try {
    const school = await School.create({
      name, code, address, city, state, pincode, phone, email, principalName,
    })

    // Auto-create principal account
    let principalUser = null
    if (principalEmail) {
      const tempPwd = `Cittaa@${Math.floor(1000 + Math.random() * 9000)}`
      principalUser = await User.create({
        name:         principalName || `Principal, ${name}`,
        email:        principalEmail.toLowerCase(),
        passwordHash: tempPwd,              // pre-save hook hashes this
        role:         'SCHOOL_PRINCIPAL',
        phone:        principalPhone,
        schoolId:     school._id,
        createdBy:    session.user.id,
      })

      // Send welcome email (non-blocking)
      sendWelcomeEmail({
        to:                principalEmail,
        name:              principalName || 'Principal',
        role:              'School Principal',
        schoolName:        name,
        temporaryPassword: tempPwd,
      }).catch((err) => console.error('[Welcome email]', err))
    }

    return NextResponse.json(
      {
        school,
        principalUser: principalUser
          ? { name: principalUser.name, email: principalUser.email }
          : null,
      },
      { status: 201 }
    )
  } catch (err: any) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field'
      return NextResponse.json(
        { error: `A school with this ${field} already exists.` },
        { status: 409 }
      )
    }
    console.error('[POST /api/schools]', err)
    return NextResponse.json({ error: 'Failed to create school' }, { status: 500 })
  }
}
