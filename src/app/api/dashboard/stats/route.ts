import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Session from '@/models/Session'
import Assessment from '@/models/Assessment'
import RCIReport from '@/models/RCIReport'
import Observation from '@/models/Observation'
import School from '@/models/School'
import { withErrorHandler } from '@/lib/monitor'
import mongoose from 'mongoose'

// Never cache this route at the Next.js / CDN layer
export const dynamic    = 'force-dynamic'
export const revalidate = 0

// ── Server-side in-memory cache (30 s TTL) ──────────────────────────────────
// Keyed by "<role>:<schoolId|global>" so each user-type gets its own snapshot.
// Eliminates repeat DB hammering when the dashboard auto-refreshes every 60 s
// AND when multiple users of the same role load the page concurrently.
const _cache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL_MS = 10_000   // 10 seconds — short enough to feel live, long enough to absorb burst refreshes

export const GET = withErrorHandler(async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { role, schoolId } = session.user
  const isCittaaAdmin = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const isSchoolAdmin = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)
  const showObs       = isSchoolAdmin || isCittaaAdmin

  // ── Cache check ──────────────────────────────────────────────────────────
  // The client always sends ?_t=<timestamp> as a cache buster.
  // We still honour our server-side TTL cache for burst protection, but if
  // the client explicitly asks for fresh data (forceRefresh param) we skip it.
  const cacheKey     = `${role}:${schoolId ?? 'global'}`
  const forceRefresh = req.nextUrl.searchParams.has('_t')
  const cached       = _cache.get(cacheKey)
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, _cached: true })
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  const schoolOid  = schoolId ? new mongoose.Types.ObjectId(schoolId) : null
  const schoolMatch = isCittaaAdmin || !schoolOid ? {} : { schoolId: schoolOid }
  const psychMatch  = role === 'PSYCHOLOGIST'
    ? { assignedPsychologistId: new mongoose.Types.ObjectId(session.user.id) }
    : {}
  const baseFilter  = { ...schoolMatch, ...psychMatch }
  const obsFilter   = isCittaaAdmin || !schoolOid ? {} : { schoolId: schoolOid }

  // ── Date helpers (IST-aware) ─────────────────────────────────────────────
  const now         = new Date()
  const todayIST    = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const istOffset   = 5.5 * 60 * 60 * 1000
  const startOfDay  = new Date(
    new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate()).getTime() - istOffset
  )
  const startOfWeek  = new Date(startOfDay.getTime() - 7  * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(todayIST.getFullYear(), todayIST.getMonth(), 1)
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)

  // ── Query 1: CounselingRequest — all stats in ONE $facet ─────────────────
  // Replaces: 5 countDocuments + 3 aggregates = 8 round trips → 1
  // Build facet object dynamically — never include conditional/no-op stages
  const crFacetDef: Record<string, any[]> = {
    total:          [{ $count: 'n' }],
    pending:        [{ $match: { status: 'PENDING_APPROVAL' } }, { $count: 'n' }],
    urgent:         [{ $match: { priority: 'URGENT', status: { $ne: 'CLOSED' } } }, { $count: 'n' }],
    closedThisMonth:[{ $match: { status: 'CLOSED', updatedAt: { $gte: startOfMonth } } }, { $count: 'n' }],
    byStatus:       [{ $group: { _id: '$status', count: { $sum: 1 } } }],
    byPriority:     [
      { $match: { status: { $ne: 'CLOSED' } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ],
    monthlyTrend:   [
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ],
  }
  // Only attach schoolCoverage for roles that actually need it
  if (isCittaaAdmin) {
    crFacetDef.schoolCoverage = [
      { $group: { _id: '$schoolId', count: { $sum: 1 } } },
      { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
      { $unwind: { path: '$school', preserveNullAndEmptyArrays: false } },
      { $project: { schoolName: '$school.name', schoolCode: '$school.code', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]
  }

  const [crFacets] = await CounselingRequest.aggregate([
    { $match: baseFilter },
    { $facet: crFacetDef },
  ])

  // ── Query 2: Observation — all obs stats in ONE $facet ───────────────────
  // Replaces: 3 countDocuments + 3 aggregates = 6 round trips → 1
  // Only executed if the role actually sees observations
  let obsFacetsPromise: Promise<any[]>
  if (showObs) {
    const obsFacetDef: Record<string, any[]> = {
      today:     [{ $match: { createdAt: { $gte: startOfDay } } }, { $count: 'n' }],
      thisWeek:  [{ $match: { createdAt: { $gte: startOfWeek } } }, { $count: 'n' }],
      thisMonth: [{ $match: { createdAt: { $gte: startOfMonth } } }, { $count: 'n' }],
      byStatus:  [{ $group: { _id: '$status', count: { $sum: 1 } } }],
    }
    if (isCittaaAdmin) {
      obsFacetDef.perSchool = [
        { $group: {
          _id:       '$schoolId',
          count:     { $sum: 1 },
          escalated: { $sum: { $cond: { if: { $eq: ['$status', 'ESCALATED'] }, then: 1, else: 0 } } },
          pending:   { $sum: { $cond: { if: { $eq: ['$status', 'SHARED'] },    then: 1, else: 0 } } },
        }},
        { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
        { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
        { $project: { schoolName: '$school.name', schoolCode: '$school.code', count: 1, escalated: 1, pending: 1 } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]
    }
    if (isSchoolAdmin) {
      obsFacetDef.classBreakdown = [
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id:       { class: '$student.class', section: '$student.section' },
          count:     { $sum: 1 },
          escalated: { $sum: { $cond: { if: { $eq: ['$status', 'ESCALATED'] }, then: 1, else: 0 } } },
          pending:   { $sum: { $cond: { if: { $eq: ['$status', 'SHARED'] },    then: 1, else: 0 } } },
        }},
        { $sort: { count: -1 } },
      ]
    }
    obsFacetsPromise = Observation.aggregate([
      { $match: obsFilter },
      { $facet: obsFacetDef },
    ])
  } else {
    obsFacetsPromise = Promise.resolve([{}])
  }

  // ── Queries 3-5: Session, Assessment+RCI, School — still parallel ─────────
  const sessionFilter  = role === 'PSYCHOLOGIST'
    ? { psychologistId: new mongoose.Types.ObjectId(session.user.id), status: 'SCHEDULED' }
    : { status: 'SCHEDULED' }
  const rciFilter = role === 'RCI_TEAM'
    ? { assignedToId: new mongoose.Types.ObjectId(session.user.id), status: { $in: ['NOTIFIED', 'VISIT_SCHEDULED'] } }
    : { ...schoolMatch, status: { $in: ['NOTIFIED', 'VISIT_SCHEDULED'] } }

  const [obsFacetsRaw, activeSessions, assessmentsPending, rciPending, activeSchoolsCount] =
    await Promise.all([
      obsFacetsPromise,
      Session.countDocuments(sessionFilter),
      Assessment.countDocuments({ status: 'PENDING_APPROVAL' }),
      RCIReport.countDocuments(rciFilter),
      isCittaaAdmin ? School.countDocuments({ isActive: true }) : Promise.resolve(0),
    ])

  // ── Unpack $facet results ─────────────────────────────────────────────────
  const cr = crFacets ?? {}
  const totalRequests  = cr.total?.[0]?.n          ?? 0
  const pendingApproval= cr.pending?.[0]?.n         ?? 0
  const urgentCases    = cr.urgent?.[0]?.n          ?? 0
  const closedThisMonth= cr.closedThisMonth?.[0]?.n ?? 0

  const requestsByStatus: Record<string, number> = {}
  ;(cr.byStatus ?? []).forEach((s: any) => { requestsByStatus[s._id] = s.count })

  const requestsByPriority: Record<string, number> = {}
  ;(cr.byPriority ?? []).forEach((p: any) => { requestsByPriority[p._id] = p.count })

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthlyTrend = (cr.monthlyTrend ?? []).map((m: any) => ({
    month: `${MONTHS[m._id.month - 1]} ${m._id.year}`,
    count: m.count,
  }))

  const schoolCoverage = cr.schoolCoverage ?? []

  // Observation facets
  const obsRaw = (obsFacetsRaw as any[])[0] ?? {}
  const obsStatusMap: Record<string, number> = {}
  ;(obsRaw.byStatus ?? []).forEach((s: any) => { obsStatusMap[s._id] = s.count })

  const result = {
    totalRequests,
    pendingApproval,
    activeSessions,
    assessmentsPending,
    rciPending,
    closedThisMonth,
    urgentCases,
    activeSchoolsCount,
    requestsByStatus,
    requestsByPriority,
    monthlyTrend,
    schoolCoverage,
    observations: {
      today:          obsRaw.today?.[0]?.n    ?? 0,
      thisWeek:       obsRaw.thisWeek?.[0]?.n ?? 0,
      thisMonth:      obsRaw.thisMonth?.[0]?.n ?? 0,
      byStatus:       obsStatusMap,
      perSchool:      obsRaw.perSchool      ?? [],
      classBreakdown: obsRaw.classBreakdown ?? [],
    },
  }

  // ── Store in cache ────────────────────────────────────────────────────────
  _cache.set(cacheKey, { data: result, ts: Date.now() })

  return NextResponse.json(result)
}, { route: '/api/dashboard/stats' })
