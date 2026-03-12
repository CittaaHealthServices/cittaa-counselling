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

  const schools = await School.find({ isActive: true }).sort({ name: 1 }).lean()

  // Add case counts for Cittaa admin
  if (session.user.role === 'CITTAA_ADMIN') {
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
    return NextResponse.json({ schools: schoolsWithStats })
  }

  return NextResponse.json({ schools })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'CITTAA_ADMIN') {
    return NextResponse.json({ error: 'Only Cittaa Admin can add schools' }, { status: 403 })
  }

  await connectDB()

  const {
    name, code, address, city, state, pincode, phone, email,
    principalName,
    // Principal login details
    principalEmail, principalPhone,
  } = await req.json()

  const school = await School.create({
    name, code: code.toUpperCase(), address, city, state, pincode, phone, email,
    principalName,
  })

  // Auto-create principal account
  let principalUser = null
  if (principalEmail) {
    const tempPwd = `Cittaa@${Math.floor(1000 + Math.random() * 9000)}`
    principalUser = await User.create({
      name: principalName || `Principal, ${name}`,
      email: principalEmail.toLowerCase(),
      passwordHash: tempPwd,
      role: 'SCHOOL_PRINCIPAL',
      phone: principalPhone,
      schoolId: school._id,
      createdBy: session.user.id,
    })

    await sendWelcomeEmail({
      to: principalEmail,
      name: principalName || `Principal`,
      role: 'School Principal',
      schoolName: name,
      temporaryPassword: tempPwd,
    })
  }

  return NextResponse.json({ school, principalUser: principalUser ? { name: principalUser.name, email: principalUser.email } : null }, { status: 201 })
}
