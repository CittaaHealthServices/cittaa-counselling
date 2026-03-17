'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  BookOpen, Calendar, CheckCircle2, XCircle, Clock,
  Plus, Filter, Search, ChevronRight, Users, Monitor,
  Wifi, MapPin, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  CLASSROOM_WORKSHOP: 'Workshop',
  GROUP_COUNSELLING:  'Group Counselling',
  TEACHER_TRAINING:   'Teacher Training',
  PEER_PROGRAM:       'Peer Program',
  PARENT_WORKSHOP:    'Parent Workshop',
  ORIENTATION:        'Orientation',
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED:   'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  POSTPONED: 'bg-orange-100 text-orange-700',
}

const TYPE_COLORS: Record<string, string> = {
  CLASSROOM_WORKSHOP: 'bg-purple-50 text-purple-700 border-purple-200',
  GROUP_COUNSELLING:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  TEACHER_TRAINING:   'bg-teal-50 text-teal-700 border-teal-200',
  PEER_PROGRAM:       'bg-amber-50 text-amber-700 border-amber-200',
  PARENT_WORKSHOP:    'bg-pink-50 text-pink-700 border-pink-200',
  ORIENTATION:        'bg-slate-50 text-slate-700 border-slate-200',
}

const MODE_ICON: Record<string, JSX.Element> = {
  ONLINE:  <Wifi size={12} />,
  OFFLINE: <MapPin size={12} />,
  HYBRID:  <Monitor size={12} />,
}

// Inner component uses useSearchParams — must be inside Suspense
function WorkshopsContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [workshops, setWorkshops] = useState<any[]>([])
  const [summary, setSummary]     = useState<any>({})
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]     = useState(true)

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter]   = useState(searchParams.get('status') || 'ALL')
  const [typeFilter, setTypeFilter]       = useState(searchParams.get('type')   || 'ALL')
  const [modeFilter, setModeFilter]       = useState('ALL')
  const [page, setPage]                   = useState(1)

  const role = session?.user?.role || ''
  const canCreate = ['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'PSYCHOLOGIST'].includes(role)

  const loadWorkshops = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page), limit: '20',
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(typeFilter   !== 'ALL' && { programType: typeFilter }),
        ...(modeFilter   !== 'ALL' && { mode: modeFilter }),
      })
      const res  = await fetch(`/api/workshops?${params}&_t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setWorkshops(data.workshops || [])
      setSummary(data.summary || {})
      setPagination(data.pagination || {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWorkshops() }, [statusFilter, typeFilter, modeFilter, page])

  const filtered = search
    ? workshops.filter(w =>
        w.title.toLowerCase().includes(search.toLowerCase()) ||
        w.theme?.toLowerCase().includes(search.toLowerCase()) ||
        w.targetGroup?.toLowerCase().includes(search.toLowerCase())
      )
    : workshops

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workshop Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Plan, schedule and track every school workshop
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadWorkshops(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          {canCreate && (
            <Link href="/dashboard/workshops/new" className="btn-primary">
              <Plus size={16} /> New Workshop
            </Link>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Scheduled', value: summary.total      ?? 0, icon: BookOpen,     color: 'text-purple-600 bg-purple-50' },
          { label: 'Planned',         value: summary.planned     ?? 0, icon: Clock,        color: 'text-blue-600 bg-blue-50' },
          { label: 'Completed',       value: summary.completed   ?? 0, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'Cancelled / Postponed', value: summary.cancelled ?? 0, icon: XCircle,  color: 'text-red-600 bg-red-50' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-900">{c.value}</div>
                <div className="text-sm text-slate-500 mt-1">{c.label}</div>
              </div>
              <div className={cn('p-2.5 rounded-xl', c.color)}>
                <c.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topics, themes…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
        >
          <option value="ALL">All Status</option>
          <option value="PLANNED">Planned</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="POSTPONED">Postponed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Program Type */}
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
        >
          <option value="ALL">All Types</option>
          {Object.entries(PROGRAM_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Mode */}
        <select
          value={modeFilter}
          onChange={e => { setModeFilter(e.target.value); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
        >
          <option value="ALL">All Modes</option>
          <option value="OFFLINE">Offline</option>
          <option value="ONLINE">Online</option>
          <option value="HYBRID">Hybrid</option>
        </select>
      </div>

      {/* Workshop list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-7 h-7 border-3 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No workshops found</p>
            <p className="text-xs mt-1">
              {canCreate ? 'Click "New Workshop" to schedule the first one.' : 'No workshops have been scheduled yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(w => (
              <Link
                key={w._id}
                href={`/dashboard/workshops/${w._id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                {/* Left: date */}
                <div className="w-14 text-center shrink-0">
                  {w.plannedDate ? (
                    <>
                      <div className="text-xs text-slate-400 uppercase">
                        {new Date(w.plannedDate).toLocaleDateString('en-IN', { month: 'short' })}
                      </div>
                      <div className="text-xl font-bold text-slate-900 leading-tight">
                        {new Date(w.plannedDate).getDate()}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(w.plannedDate).toLocaleDateString('en-IN', { weekday: 'short' })}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-300 mt-2">TBD</div>
                  )}
                </div>

                {/* Middle: details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', TYPE_COLORS[w.programType] || 'bg-slate-50 text-slate-600 border-slate-200')}>
                      {PROGRAM_TYPE_LABELS[w.programType] || w.programType}
                    </span>
                    {w.priority === 'HIGH' && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle size={10} /> High Priority
                      </span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[w.status] || 'bg-slate-100 text-slate-600')}>
                      {w.status.charAt(0) + w.status.slice(1).toLowerCase()}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
                    {w.title}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {w.targetGroup}
                    </span>
                    <span className="flex items-center gap-1">
                      {MODE_ICON[w.mode]} {w.mode.charAt(0) + w.mode.slice(1).toLowerCase()}
                    </span>
                    {w.theme && (
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                        {w.theme}
                      </span>
                    )}
                    {w.schoolId?.name && (
                      <span className="text-slate-400">{w.schoolId.name}</span>
                    )}
                  </div>
                </div>

                {/* Right: attendance + arrow */}
                <div className="flex items-center gap-4 shrink-0">
                  {w.status === 'COMPLETED' && w.actualAttendance != null && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{w.actualAttendance}</div>
                      <div className="text-xs text-slate-400">attended</div>
                    </div>
                  )}
                  {w.feedbackScore && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-600">{w.feedbackScore}/5</div>
                      <div className="text-xs text-slate-400">feedback</div>
                    </div>
                  )}
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-purple-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between text-sm text-slate-500">
            <span>{pagination.total} workshops total</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >Prev</button>
              <span className="px-3 py-1">{page} / {pagination.pages}</span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Wrap in Suspense to satisfy Next.js 14 requirement for useSearchParams
export default function WorkshopsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    }>
      <WorkshopsContent />
    </Suspense>
  )
}
