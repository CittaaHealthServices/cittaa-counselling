import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import RCIReport from '@/models/RCIReport'
import mongoose from 'mongoose'

// ─── GET /api/rci — list RCI reports ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, id: userId, schoolId } = session.user
  const { searchParams } = req.nextUrl

  const filter: any = {}
  const status = searchParams.get('status')

  if (role === 'RCI_TEAM') {
    filter.assignedToId = new mongoose.Types.ObjectId(userId)
  } else if (['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)) {
    // Get reports linked to this school's requests
    const CounselingRequest = (await import('@/models/CounselingRequest')).default
    const requestIds = await CounselingRequest.find({
      schoolId: new mongoose.Types.ObjectId(schoolId!),
    }).distinct('_id')
    filter.assessmentId = { $exists: true } // linked via assessment
    // Alternative: filter by school via lookup in aggregation
    // For simplicity, we query via the assessment's requestId → school
    // Use a broader query and let the population handle it
    delete filter.assessmentId
    const Assessment = (await import('@/models/Assessment')).default
    const assessmentIds = await Assessment.find({
      requestId: { $in: requestIds },
    }).distinct('_id')
    filter.assessmentId = { $in: assessmentIds }
  } else if (['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)) {
    // All reports; optionally filter by school
    const filterSchool = searchParams.get('schoolId')
    if (filterSchool) {
      const CounselingRequest = (await import('@/models/CounselingRequest')).default
      const Assessment = (await import('@/models/Assessment')).default
      const requestIds = await CounselingRequest.find({
        schoolId: new mongoose.Types.ObjectId(filterSchool),
      }).distinct('_id')
      const assessmentIds = await Assessment.find({ requestId: { $in: requestIds } }).distinct('_id')
      filter.assessmentId = { $in: assessmentIds }
    }
  } else {
    return NextResponse.json({ rciReports: [] })
  }

  if (status && status !== 'ALL') filter.status = status

  const page  = parseInt(searchParams.get('page')  || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip  = (page - 1) * limit

  const [rciReports, total] = await Promise.all([
    RCIReport.find(filter)
      .populate({
        path: 'assessmentId',
        populate: {
          path: 'requestId',
          populate: [
            { path: 'studentId',  select: 'name class section' },
            { path: 'schoolId',   select: 'name code' },
          ],
        },
      })
      .populate('assignedToId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RCIReport.countDocuments(filter),
  ])

  return NextResponse.json({
    rciReports,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}
