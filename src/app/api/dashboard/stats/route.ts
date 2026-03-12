import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Session from '@/models/Session'
import Assessment from '@/models/Assessment'
import RCIReport from '@/models/RCIReport'
import Observation from '@/models/Observation'
import mongoose from 'mongoose'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, schoolId } = session.user
  const isCittaaAdmin   = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const isSchoolAdmin   = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)

  const schoolFilter = (isCittaaAdmin || !schoolId)
    ? {}
    : { schoolId: new mongoose.Types.ObjectId(schoolId) }

  const psychFilter = role === 'PSYCHOLOGIST'
    ? { assignedPsychologistId: new mongoose.Types.ObjectId(session.user.id) }
    : {}

  const baseFilter = { ...schoolFilter, ...psychFilter }

  // ── Date helpers ──────────────────────────────────────────────────────────
  const now       = new Date()
  const todayIST  = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const startOfToday = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate())
  // Convert back to UTC
  const startOfTodayUTC = new Date(startOfToday.getTime() - (5.5 * 60 * 60 * 1000))
  const startOfWeekUTC  = new Date(startOfTodayUTC.getTime() - 7  * 24 * 60 * 60 * 1000)
  const startOfMonthUTC = new Date(todayIST.getFullYear(), todayIST.getMonth(), 1)

  // Observation filter mirrors school filter
  const obsFilter = isCittaaAdmin
    ? {}
    : { schoolId: new mongoose.Types.ObjectId(schoolId!) }

  // Parallel queries for performance
  const [
    totalRequests,
    pendingApproval,
    activeSessions,
    assessmentsPending,
    rciPending,
    closedThisMonth,
    urgentCases,
    statusAgg,
    priorityAgg,
    monthlyTrend,
    schoolCoverage,
    // Observation stats (principal + admin only)
    obsToday,
    obsThisWeek,
    obsThisMonth,
    obsStatusCounts,
    obsPerSchool,
    obsClassBreakdown,
  ] = await Promise.all([
    CounselingRequest.countDocuments(baseFilter),
    CounselingRequest.countDocuments({ ...baseFilter, status: 'PENDING_APPROVAL' }),
    Session.countDocuments({
      ...(role === 'PSYCHOLOGIST' ? { psychologistId: new mongoose.Types.ObjectId(session.user.id) } : {}),
      status: 'SCHEDULED',
    }),
    Assessment.countDocuments({ status: 'PENDING_APPROVAL' }),
    RCIReport.countDocuments({
      ...(role === 'RCI_TEAM' ? { assignedToId: new mongoose.Types.ObjectId(session.user.id) } : schoolFilter),
      status: { $in: ['NOTIFIED', 'VISIT_SCHEDULED'] },
    }),
    CounselingRequest.countDocuments({
      ...baseFilter,
      status: 'CLOSED',
      updatedAt: { $gte: new Date(todayIST.getFullYear(), todayIST.getMonth(), 1) },
    }),
    CounselingRequest.countDocuments({ ...baseFilter, priority: 'URGENT', status: { $ne: 'CLOSED' } }),

    // Status breakdown
    CounselingRequest.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // Priority breakdown
    CounselingRequest.aggregate([
      { $match: { ...baseFilter, status: { $ne: 'CLOSED' } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    // Last 6 months trend
    CounselingRequest.aggregate([
      { $match: { ...baseFilter, createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    // School coverage (Cittaa admin only)
    isCittaaAdmin
      ? CounselingRequest.aggregate([
          { $group: { _id: '$schoolId', count: { $sum: 1 } } },
          { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
          { $unwind: '$school' },
          { $project: { schoolName: '$school.name', schoolCode: '$school.code', count: 1 } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
      : Promise.resolve([]),

    // ── Observation counts ────────────────────────────────────────────────
    // Today
    (isSchoolAdmin || isCittaaAdmin)
      ? Observation.countDocuments({ ...obsFilter, createdAt: { $gte: startOfTodayUTC } })
      : Promise.resolve(0),
    // This week
    (isSchoolAdmin || isCittaaAdmin)
      ? Observation.countDocuments({ ...obsFilter, createdAt: { $gte: startOfWeekUTC } })
      : Promise.resolve(0),
    // This month
    (isSchoolAdmin || isCittaaAdmin)
      ? Observation.countDocuments({ ...obsFilter, createdAt: { $gte: startOfMonthUTC } })
      : Promise.resolve(0),
    // Status breakdown
    (isSchoolAdmin || isCittaaAdmin)
      ? Observation.aggregate([
          { $match: obsFilter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    // Per-school observation count (Cittaa admin)
    isCittaaAdmin
      ? Observation.aggregate([
          { $group: { _id: '$schoolId', count: { $sum: 1 }, escalated: { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'SHARED'] }, 1, 0] } } } },
          { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
          { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
          { $project: { schoolName: '$school.name', schoolCode: '$school.code', count: 1, escalated: 1, pending: 1 } },
          { $sort: { count: -1 } },
          { $limit: 15 },
        ])
      : Promise.resolve([]),
    // Class-level breakdown for principal (which classes had observations this month)
    isSchoolAdmin
      ? Observation.aggregate([
          { $match: { ...obsFilter, createdAt: { $gte: startOfMonthUTC } } },
          { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
          { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
          { $group: {
            _id: { class: '$student.class', section: '$student.section' },
            count:     { $sum: 1 },
            escalated: { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED'] }, 1, 0] } },
            pending:   { $sum: { $cond: [{ $eq: ['$status', 'SHARED'] }, 1, 0] } },
          }},
          { $sort: { count: -1 } },
        ])
      : Promise.resolve([]),
  ])

  const requestsByStatus: Record<string, number> = {}
  statusAgg.forEach((s: any) => { requestsByStatus[s._id] = s.count })

  const requestsByPriority: Record<string, number> = {}
  priorityAgg.forEach((p: any) => { requestsByPriority[p._id] = p.count })

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthlyTrendFormatted = monthlyTrend.map((m: any) => ({
    month: `${MONTHS[m._id.month - 1]} ${m._id.year}`,
    count: m.count,
  }))

  const obsStatusMap: Record<string, number> = {}
  obsStatusCounts.forEach((s: any) => { obsStatusMap[s._id] = s.count })

  return NextResponse.json({
    totalRequests,
    pendingApproval,
    activeSessions,
    assessmentsPending,
    rciPending,
    closedThisMonth,
    urgentCases,
    requestsByStatus,
    requestsByPriority,
    monthlyTrend: monthlyTrendFormatted,
    schoolCoverage,
    // Observation stats
    observations: {
      today:        obsToday,
      thisWeek:     obsThisWeek,
      thisMonth:    obsThisMonth,
      byStatus:     obsStatusMap,
      perSchool:    obsPerSchool,   // for Cittaa admin
      classBreakdown: obsClassBreakdown, // for principal
    },
  })
}
