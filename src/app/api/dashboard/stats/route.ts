import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import CounselingRequest from '@/models/CounselingRequest'
import Observation from '@/models/Observation'
import Student from '@/models/Student'
import Workshop from '@/models/Workshop'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

const CACHE_TTL = 10_000
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

  const crFilter:  any = {}
  const obsFilter: any = {}
  const wkFilter:  any = {}

  if (isSchoolUser && userSchoolId) {
    const sid = new mongoose.Types.ObjectId(userSchoolId)
    crFilter.schoolId  = sid
    obsFilter.schoolId = sid
    wkFilter.schoolId  = sid
  } else if (isPsychologist) {
    const uid = new mongoose.Types.ObjectId(userId)
    crFilter.assignedTo      = uid
    obsFilter.conductedById  = uid
    wkFilter.conductedById   = uid
  }

  // ── Facet builders ─────────────────────────────────────────────────────────
  const crFacet: Record<string, any[]> = {
    total:     [{ $count: 'n' }],
    pending:   [{ $match: { status: 'PENDING_APPROVAL' } }, { $count: 'n' }],
    active:    [{ $match: { status: { $in: ['APPROVED','SCHEDULED','IN_PROGRESS'] } } }, { $count: 'n' }],
    resolved:  [{ $match: { status: { $in: ['COMPLETED','CLOSED'] } } }, { $count: 'n' }],
    today:     [{ $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } }, { $count: 'n' }],
    thisWeek:  [{ $match: { createdAt: { $gte: weekStart  } } }, { $count: 'n' }],
    thisMonth: [{ $match: { createdAt: { $gte: monthStart } } }, { $count: 'n' }],
    byStatus:  [{ $group: { _id: '$status', count: { $sum: 1 } } }],
    bySeverity:[{ $group: { _id: null,
      high:   { $sum: { $cond: { if: { $eq: ['$severity','HIGH']   }, then: 1, else: 0 } } },
      medium: { $sum: { $cond: { if: { $eq: ['$severity','MEDIUM'] }, then: 1, else: 0 } } },
      low:    { $sum: { $cond: { if: { $eq: ['$severity','LOW']    }, then: 1, else: 0 } } },
    }}],
  }
  if (isCittaaAdmin) crFacet.schoolCoverage = [
    { $group: { _id: '$schoolId', count: { $sum: 1 } } },
    { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 's' } },
    { $unwind: { path: '$s', preserveNullAndEmptyArrays: true } },
    { $project: { name: '$s.name', count: 1 } },
    { $sort: { count: -1 } }, { $limit: 10 },
  ]

  const obsFacet: Record<string, any[]> = {
    total:     [{ $count: 'n' }],
    today:     [{ $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } }, { $count: 'n' }],
    thisWeek:  [{ $match: { createdAt: { $gte: weekStart  } } }, { $count: 'n' }],
    thisMonth: [{ $match: { createdAt: { $gte: monthStart } } }, { $count: 'n' }],
    awaitingReview: [{ $match: { status: 'AWAITING_REVIEW' } }, { $count: 'n' }],
    escalated:      [{ $match: { status: 'ESCALATED'       } }, { $count: 'n' }],
  }

  const wkFacet: Record<string, any[]> = {
    total:     [{ $count: 'n' }],
    planned:   [{ $match: { status: { $in: ['PLANNED','CONFIRMED'] } } }, { $count: 'n' }],
    completed: [{ $match: { status: 'COMPLETED' } }, { $count: 'n' }],
    cancelled: [{ $match: { status: { $in: ['CANCELLED','POSTPONED'] } } }, { $count: 'n' }],
    thisMonth: [{ $match: { plannedDate: { $gte: monthStart } } }, { $count: 'n' }],
  }

  const [crRes, obsRes, wkRes, studentCount] = await Promise.all([
    CounselingRequest.aggregate([{ $match: crFilter  }, { $facet: crFacet  }]),
    Observation.aggregate(      [{ $match: obsFilter }, { $facet: obsFacet }]),
    Workshop.aggregate(         [{ $match: wkFilter  }, { $facet: wkFacet  }]),
    (isCittaaAdmin || isSchoolUser)
      ? Student.countDocuments(isSchoolUser && userSchoolId
          ? { schoolId: new mongoose.Types.ObjectId(userSchoolId) } : {})
      : Promise.resolve(0),
  ])

  const cr  = crRes[0]  ?? {}
  const obs = obsRes[0] ?? {}
  const wk  = wkRes[0]  ?? {}
  const n   = (arr?: any[]) => arr?.[0]?.n ?? 0

  const data = {
    counselingRequests: {
      total: n(cr.total), pending: n(cr.pending), active: n(cr.active),
      resolved: n(cr.resolved), today: n(cr.today),
      thisWeek: n(cr.thisWeek), thisMonth: n(cr.thisMonth),
      byStatus: cr.byStatus ?? [],
      bySeverity: cr.bySeverity?.[0] ?? { high: 0, medium: 0, low: 0 },
      ...(isCittaaAdmin ? { schoolCoverage: cr.schoolCoverage ?? [] } : {}),
    },
    observations: {
      total: n(obs.total), today: n(obs.today),
      thisWeek: n(obs.thisWeek), thisMonth: n(obs.thisMonth),
      awaitingReview: n(obs.awaitingReview), escalated: n(obs.escalated),
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
