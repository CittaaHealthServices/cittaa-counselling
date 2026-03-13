import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import dbConnect from '@/lib/db'
import Student from '@/models/Student'

// GET /api/students/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role     = session.user.role as string
  const schoolId = session.user.schoolId as string | undefined

  await dbConnect()
  try {
    const student = await Student.findById(params.id)
      .populate('schoolId', 'name city state')
      .lean()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // School-scoped roles can only view students from their school
    const schoolRoles = [
      'CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN',
    ]
    if (schoolRoles.includes(role)) {
      const studentSchool = (student.schoolId as any)?._id?.toString() || (student.schoolId as any)?.toString()
      if (studentSchool !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ student })
  } catch (err) {
    console.error('GET /api/students/[id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH /api/students/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role     = session.user.role as string
  const schoolId = session.user.schoolId as string | undefined

  // Only admins, principals, or coordinators can update students
  const allowedRoles = [
    'CITTAA_ADMIN', 'CITTAA_SUPPORT',
    'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'COORDINATOR',
  ]
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await dbConnect()
  try {
    const existing = await Student.findById(params.id).lean()
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // School-scoped check
    const schoolRoles = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'COORDINATOR']
    if (schoolRoles.includes(role)) {
      const studentSchool = (existing.schoolId as any)?.toString()
      if (studentSchool !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await req.json()

    const allowed = [
      'name', 'dob', 'gender', 'class', 'section', 'rollNumber',
      'parentName', 'parentPhone', 'parentEmail', 'address',
      'medicalNotes', 'isActive',
    ]
    const update: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    const student = await Student.findByIdAndUpdate(
      params.id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate('schoolId', 'name city state')
      .lean()

    return NextResponse.json({ student })
  } catch (err) {
    console.error('PATCH /api/students/[id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
