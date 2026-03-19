import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Observation from '@/models/Observation'
import Student from '@/models/Student'
import Workshop from '@/models/Workshop'
import Assessment from '@/models/Assessment'
import RCIReport from '@/models/RCIReport'
import School from '@/models/School'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

const CACHE_TTL = 15_000 // 15s
const _cache    = new Map<string, { data: any; ts: number }>()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, id: userId, schoolId: userSchoolId } = session.user
  const isCittaaAdmin  = ['CITTAA_ADMIN','CITTAA_SUPPORT'].includes(role)
  const isSchoolUser   = ['SCHOOL_PRINCIPAL','SCHOOL_ADMIN','CLASS_TEACHER','COORDINATOR'].includes(role)
  const isPsychologist = role === 'PSYCHOLOGIST'

  const cacheKey    = `${role}:${userId}`
  const forceRefresh = req.nextUrl.searchParams.has('_t')
  const cached      = _cache.get(cacheKey)
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL)
    return NextResponse.json({ ...cached.data, _cached: true })

  await connectDB()

  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999)
  const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── Scope filters ────────────────────────────────────────────────────────────
  const crFilter:  any = {}
  const obsFilter: any = {}
  const wkFilter:  any = {}
  const asmFilter: any = {}

  if (isSchoolUser && userSchoolId) {
    const sid = new mongoose.Types.ObjectId(userSchoolId)
    crFilter.schoolId  = sid
    obsFilter.schoolId = sid
    wkFilter.schoolId  = sid
  } else if (isPsychologist) {
    const uid = new mongoose.Types.ObjectId(userId)
    crFilter.assignedTo     = uid
    obsFilter.conductedById = uid
    wkFilter.conductedById  = uid
    asmFilter.requestedById = uid
  }

  // ── Monthly trend: last 6 months ─────────────────────────────────────────────
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const n = (arr?: any[]) => arr?.[0]?.n ?? 0

  // ── Run all aggregations in parallel ─────────────────────────────────────────
  const [crRes, obsRes, wkRes, studentCount, asmPending, rciPending,
         activeSchools, monthlyTrendRaw, urgentCount, closedThisMonthCount] = await Promise.all([

    CounselingRequest.aggregate([
      { $match: crFilter },
      { $facet: {
        total:    [{ $count: 'n' }],
        pending:  [{ $match: { status: 'PENDING_APPROVAL' } }, { $count: 'n' }],
        active:   [{ $match: { status: { $in: ['APPROVED','SCHEDULED','IN_PROGRESS',
                    'PSYCHOLOGIST_ASSIGNED','SESSION_SCHEDULED','SESSION_COMPLETED'] } } }, { $count: 'n' }],
        resolved: [{ $match: { status: { $in: ['COMPLETED','CLOSED'] } } }, { $count: 'n' }],
        today:    [{ $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } }, { $count: 'n' }],
        thisWeek: [{ $match: { createdAt: { $gte: weekStart } } }, { $count: 'n' }],
        thisMonth:[{ $match: { createdAt: { $gte: monthStart } } }, { $count: 'n' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        bySeverity:[{ $group: { _id: null,
          high:   { $sum: { $cond: [{ $eq: ['$severity','HIGH'] },   1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$severity','MEDIUM'] }, 1, 0] } },
          low:    { $sum: { $cond: [{ $eq: ['$severity','LOW'] },    1, 0] } },
        }}],
        ...(isCittaaAdmin ? { schoolCoverage: [
          { $group: { _id: '$schoolId', count: { $sum: 1 } } },
          { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 's' } },
          { $unwind: { path: '$s', preserveNullAndEmptyArrays: true } },
          { $project: { schoolName: '$s.name', schoolCode: '$s.code', count: 1 } },
          { $sort: { count: -1 } }, { $limit: 10 },
        ]} : {}),
      }},
    ]),

    Observation.aggregate([
      { $match: obsFilter },
      { $facet: {
        total:          [{ $count: 'n' }],
        today:          [{ $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } }, { $count: 'n' }],
        thisWeek:       [{ $match: { createdAt: { $gte: weekStart  } } }, { $count: 'n' }],
        thisMonth:      [{ $match: { createdAt: { $gte: monthStart } } }, { $count: 'n' }],
        awaitingReview: [{ $match: { status: 'AWAITING_REVIEW' } }, { $count: 'n' }],
        escalated:      [{ $match: { status: 'ESCALATED'       } }, { $count: 'n' }],
        byStatus:       [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      }},
    ]),

    Workshop.aggregate([
      { $match: wkFilter },
      { $facet: {
        total:     [{ $count: 'n' }],
        planned:   [{ $match: { status: { $in: ['PLANNED','CONFIRMED'] } } }, { $count: 'n' }],
        completed: [{ $match: { status: 'COMPLETED' } }, { $count: 'n' }],
        cancelled: [{ $match: { status: { $in: ['CANCELLED','POSTPONED'] } } }, { $count: 'n' }],
        thisMonth: [{ $match: { plannedDate: { $gte: monthStart } } }, { $count: 'n' }],
      }},
    ]),

    // Student count
    (isCittaaAdmin || isSchoolUser)
      ? Student.countDocuments(isSchoolUser && userSchoolId
          ? { schoolId: new mongoose.Types.ObjectId(userSchoolId) } : {})
      : Promise.resolve(0),

    // Assessments pending approval
    Assessment.countDocuments({ ...asmFilter, status: 'PENDING_APPROVAL' }).catch(() => 0),

    // RCI pending (not yet submitted)
    RCIReport.countDocuments({ status: { $in: ['NOTIFIED','VISIT_SCHEDULED','VISITING'] } }).catch(() => 0),

    // Active schools (Cittaa admin only)
    isCittaaAdmin
      ? (School as any).countDocuments({ isActive: true }).catch(() => 0)
      : Promise.resolve(0),

    // Monthly trend last 6 months
    CounselingRequest.aggregate([
      { $match: { ...crFilter, createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $project: {
        _id: 0,
        month: { $concat: [
          { $arrayElemAt: [['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            '$_id.month'] },
          ' ',
          { $substr: [{ $toString: '$_id.year' }, 2, 2] },
        ]},
        count: 1,
      }},
    ]),

    // Urgent / high-severity pending cases
    CounselingRequest.countDocuments({
      ...crFilter,
      status: { $nin: ['COMPLETED','CLOSED','DECLINED'] },
      $or: [{ severity: 'HIGH' }, { priority: 'URGENT' }, { priority: 'HIGH' }],
    }).catch(() => 0),

    // Closed this month
    CounselingRequest.countDocuments({
      ...crFilter,
      status: { $in: ['COMPLETED','CLOSED'] },
      updatedAt: { $gte: monthStart },
    }).catch(() => 0),
  ])

  const cr  = crRes[0]  ?? {}
  const obs = obsRes[0] ?? {}
  const wk  = wkRes[0]  ?? {}

  // Convert byStatus array → flat object  { STATUS: count }
  const requestsByStatus: Record<string,number> = {}
  for (const s of (cr.byStatus ?? [])) requestsByStatus[s._id] = s.count

  const obsByStatus: Record<string,number> = {}
  for (const s of (obs.byStatus ?? [])) obsByStatus[s._id] = s.count

  const data = {
    // ── FLAT KEYS (what the dashboard page reads) ──────────────────────────────
    totalRequests:      n(cr.total),
    pendingApproval:    n(cr.pending),
    activeSessions:     n(cr.active),
    closedThisMonth:    closedThisMonthCount as number,
    urgentCases:        urgentCount as number,
    assessmentsPending: asmPending as number,
    rciPending:         rciPending as number,
    activeSchoolsCount: activeSchools as number,
    monthlyTrend:       monthlyTrendRaw,
    requestsByStatus,
    schoolCoverage:     cr.schoolCoverage ?? [],

    // ── NESTED (structured, for future use) ────────────────────────────────────
    counselingRequests: {
      total: n(cr.total), pending: n(cr.pending), active: n(cr.active),
      resolved: n(cr.resolved), today: n(cr.today),
      thisWeek: n(cr.thisWeek), thisMonth: n(cr.thisMonth),
      byStatus: requestsByStatus,
      bySeverity: cr.bySeverity?.[0] ?? { high: 0, medium: 0, low: 0 },
    },
    observations: {
      total: n(obs.total), today: n(obs.today),
      thisWeek: n(obs.thisWeek), thisMonth: n(obs.thisMonth),
      awaitingReview: n(obs.awaitingReview), escalated: n(obs.escalated),
      byStatus: obsByStatus,
    },
    workshops: {
      total: n(wk.total), planned: n(wk.planned),
      completed: n(wk.completed), cancelled: n(wk.cancelled),
      thisMonth: n(wk.thisMonth),
    },
    students:  { total: studentCount as number },
    meta: { role, generatedAt: new Date().toISOString() },
  }

  _cache.set(cacheKey, { data, ts: Date.now() })
  return NextResponse.json(data)
}
