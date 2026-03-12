import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Student from '@/models/Student'
import mongoose from 'mongoose'

// ─── GET /api/students ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, schoolId } = session.user
  const { searchParams } = req.nextUrl

  const filter: any = { isActive: true }

  // All school-level users see only their school's students
  if (['SCHOOL_PRINCIPAL', 'COORDINATOR', 'CLASS_TEACHER'].includes(role)) {
    filter.schoolId = new mongoose.Types.ObjectId(schoolId!)
  } else if (role === 'CITTAA_ADMIN') {
    const filterSchool = searchParams.get('schoolId')
    if (filterSchool) filter.schoolId = new mongoose.Types.ObjectId(filterSchool)
  } else {
    return NextResponse.json({ students: [] })
  }

  // Search
  const search = searchParams.get('search')
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
    ]
  }

  const classFilter = searchParams.get('class')
  if (classFilter) filter.class = classFilter

  const students = await Student.find(filter)
    .populate('schoolId', 'name code')
    .sort({ name: 1 })
    .lean()

  return NextResponse.json({ students })
}

// ─── POST /api/students — add single student ──────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, schoolId } = session.user
  if (!['SCHOOL_PRINCIPAL', 'COORDINATOR', 'CITTAA_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const { name, rollNumber, class: studentClass, section, age, gender, parentName, parentPhone, parentEmail, targetSchoolId } = await req.json()

  const assignedSchoolId = role === 'CITTAA_ADMIN' ? targetSchoolId : schoolId

  const student = await Student.create({
    name,
    rollNumber,
    class: studentClass,
    section,
    age,
    gender,
    parentName,
    parentPhone,
    parentEmail,
    schoolId: assignedSchoolId,
  })

  return NextResponse.json({ student }, { status: 201 })
}
