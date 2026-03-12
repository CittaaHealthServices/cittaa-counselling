import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Student from '@/models/Student'

/**
 * POST /api/students/bulk
 * Accepts a JSON array of student objects for bulk import.
 * Used by school admins / coordinators to upload students from CSV/Excel.
 *
 * Expected payload:
 * {
 *   students: [{ name, rollNumber, class, section, age, gender, parentName, parentPhone, parentEmail }]
 * }
 *
 * On the frontend, the user parses a CSV and sends the array here.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, schoolId } = session.user
  if (!['SCHOOL_PRINCIPAL', 'COORDINATOR', 'CITTAA_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  await connectDB()

  const { students, targetSchoolId } = await req.json()

  if (!Array.isArray(students) || students.length === 0) {
    return NextResponse.json({ error: 'No students provided' }, { status: 400 })
  }
  if (students.length > 2000) {
    return NextResponse.json({ error: 'Maximum 2000 students per upload' }, { status: 400 })
  }

  const assignedSchoolId = role === 'CITTAA_ADMIN' ? targetSchoolId : schoolId

  const docs = students.map((s: any) => ({
    name:        s.name?.trim(),
    rollNumber:  s.rollNumber?.toString().trim() || undefined,
    class:       s.class?.toString().trim(),
    section:     s.section?.trim() || undefined,
    age:         s.age ? parseInt(s.age) : undefined,
    gender:      s.gender?.toUpperCase() || undefined,
    parentName:  s.parentName?.trim() || undefined,
    parentPhone: s.parentPhone?.toString().trim() || undefined,
    parentEmail: s.parentEmail?.toLowerCase().trim() || undefined,
    schoolId:    assignedSchoolId,
    isActive:    true,
  })).filter((s: any) => s.name && s.class)  // must have name and class

  let inserted = 0
  let skipped  = 0
  const errors: string[] = []

  // Use insertMany with ordered: false to continue on duplicates
  try {
    const result = await Student.insertMany(docs, { ordered: false })
    inserted = result.length
  } catch (err: any) {
    // BulkWriteError: some succeeded, some failed (e.g. duplicate roll numbers)
    if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
      inserted = err.result?.nInserted || 0
      skipped  = docs.length - inserted
      errors.push(`${skipped} students skipped (duplicate roll numbers)`)
    } else {
      console.error('Bulk insert error:', err)
      return NextResponse.json({ error: 'Bulk insert failed', details: err.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    errors,
    message: `${inserted} students imported successfully${skipped > 0 ? `, ${skipped} skipped` : ''}`,
  })
}
