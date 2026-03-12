import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { sendWelcomeEmail } from '@/lib/email'
import { Role } from '@/types'

// ─── GET /api/users — list users ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, schoolId } = session.user
  const { searchParams } = req.nextUrl

  const filter: any = { isActive: true }
  const userRole = searchParams.get('role')
  const available = searchParams.get('available')

  if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)) {
    // School admin/principal can see users in their school (or psychologists for assignment)
    const onlyPsychologists = userRole === 'PSYCHOLOGIST'
    if (onlyPsychologists) {
      filter.role = 'PSYCHOLOGIST'
    } else {
      filter.schoolId = schoolId
    }
  } else if (['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)) {
    // Can filter by school
    const filterSchool = searchParams.get('schoolId')
    if (filterSchool) filter.schoolId = filterSchool
  } else if (['COORDINATOR', 'CLASS_TEACHER'].includes(role)) {
    // Teachers can query CLASS_TEACHER/COORDINATOR list in their school (for observation sharing)
    filter.schoolId = schoolId
    if (!userRole || ['CLASS_TEACHER', 'COORDINATOR'].includes(userRole)) {
      if (userRole) filter.role = userRole
      else filter.role = { $in: ['CLASS_TEACHER', 'COORDINATOR'] }
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (userRole && userRole !== 'PSYCHOLOGIST') filter.role = userRole
  if (available === 'true') filter.isAvailable = true

  const users = await User.find(filter)
    .populate('schoolId', 'name code')
    .select('-passwordHash')
    .sort({ name: 1 })
    .lean()

  return NextResponse.json({ users })
}

// ─── POST /api/users — create user ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role: creatorRole, schoolId: creatorSchoolId } = session.user

  // Who can create users?
  // - CITTAA_ADMIN: can create any role
  // - SCHOOL_PRINCIPAL / SCHOOL_ADMIN: can create COORDINATOR, CLASS_TEACHER, SCHOOL_ADMIN for their school
  if (!['CITTAA_ADMIN', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(creatorRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const { name, email, role, phone, schoolId, qualification, specialization, employeeId } = await req.json()

  // School principal/admin can only create school-level roles
  if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(creatorRole)) {
    const allowed = ['COORDINATOR', 'CLASS_TEACHER', 'SCHOOL_ADMIN']
    if (!allowed.includes(role)) {
      return NextResponse.json({
        error: 'School staff can only create Coordinator, Class Teacher, and School Admin accounts',
      }, { status: 403 })
    }
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() })
  if (existingUser) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  }

  // Generate temp password
  const tempPassword = `Cittaa@${Math.floor(1000 + Math.random() * 9000)}`

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: tempPassword, // will be hashed by pre-save hook
    role,
    phone,
    schoolId: ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(creatorRole) ? creatorSchoolId : schoolId,
    qualification,
    specialization: specialization ? specialization.split(',').map((s: string) => s.trim()) : [],
    employeeId,
    createdBy: session.user.id,
  })

  const populated = await User.findById(user._id)
    .populate('schoolId', 'name code')
    .select('-passwordHash')
    .lean()

  // Send welcome email
  await sendWelcomeEmail({
    to: email,
    name,
    role,
    schoolName: (populated as any)?.schoolId?.name,
    temporaryPassword: tempPassword,
  })

  return NextResponse.json({ user: populated }, { status: 201 })
}
