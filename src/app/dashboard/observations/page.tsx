'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Eye, Plus, Search, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, XCircle, ArrowUpCircle, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Obs = {
  _id: string
  studentId: { _id: string; name: string; class?: string; section?: string; rollNumber?: string } | null
  conductedById: { name: string } | null
  classObserved: string
  visitDate: string
  behaviourFlags: string[]
  observationNotes: string
  sharedWith: { _id: string; name: string }[]
  sharedWithEmails: string[]
  recommendEscalation: boolean
  status: string
  escalatedRequestId?: any
}

const STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  DRAFT:           { label: 'Draft',               cls: 'bg-slate-100 text-slate-600',   Icon: Clock },
  AWAITING_REVIEW: { label: 'Awaiting Review',     cls: 'bg-yellow-100 text-yellow-700', Icon: AlertTriangle },
  ACKNOWLEDGED:    { label: 'Acknowledged',        cls: 'bg-green-100 text-green-700',   Icon: CheckCircle2 },
  ESCALATED:       { label: 'Escalated → Request', cls: 'bg-purple-100 text-purple-700', Icon: ArrowUpCircle },
  DECLINED:        { label: 'Declined',            cls: 'bg-red-100 text-red-700',       Icon: XCircle },
}
const TABS = ['ALL','DRAFT','AWAITING_REVIEW','ACKNOWLEDGED','ESCALATED','DECLINED']

export default function ObservationsPage() {
  const { data: session }   = useSession()
  const [all, setAll]       = useState<Obs[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState('ALL')
  const [q, setQ]           = useState('')
  const [actId, setActId]   = useState<string|null>(null)
  const [err, setErr]       = useState('')

  const role = session?.user?.role ?? ''
  const canCreate    = ['PSYCHOLOGIST','CITTAA_ADMIN','CITTAA_SUPPORT'].includes(role)
  const canRecommend = ['PSYCHOLOGIST','CITTAA_ADMIN','CITTAA_SUPPORT'].includes(role)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res  = await fetch(`/api/observations?limit=100&_t=${Date.now()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setAll(data.observations ?? [])
    } catch { setErr('Could not load observations.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const recommend = async (obs: Obs) => {
    if (actId) return
    setActId(obs._id); setErr('')
    try {
      const res  = await fetch(`/api/observations/${obs._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recommend' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAll(prev => prev.map(o => o._id === obs._id ? data.observation : o))
    } catch (e: any) { setErr(e.message) }
    finally { setActId(null) }
  }

  const shown = all
    .filter(o => tab === 'ALL' || o.status === tab)
    .filter(o => !q || [o.studentId?.name, o.classObserved, ...(o.behaviourFlags || [])]
      .some(v => v?.toLowerCase().includes(q.toLowerCase())))

  const cnt = (t: string) => t === 'ALL' ? all.length : all.filter(o => o.status === t).length

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classroom Observations</h1>
          <p className="text-slate-500 text-sm mt-0.5">Record classroom visit notes and share with the respective teacher or coordinator</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/observations/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow transition">
            <Plus size={15} /> New Observation
          </Link>
        )}
      </div>

      {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{err}</div>}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap',
              tab === t ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}>
            {t === 'ALL' ? 'All' : STATUS[t]?.label ?? t}
            {cnt(t) > 0 && (
              <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                tab === t ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600')}>
                {cnt(t)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search student, class, flag…" value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Eye size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No observations found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Student','Class Observed','Behaviour Flags','Shared With','Visit Date','Status','Actions']
                  .map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map(obs => {
                const s    = STATUS[obs.status] ?? STATUS.DRAFT
                const Icon = s.Icon
                return (
                  <tr key={obs._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{obs.studentId?.name ?? '—'}</p>
                      <p className="text-xs text-slate-400">
                        {[obs.studentId?.class, obs.studentId?.section].filter(Boolean).join(' ') || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{obs.classObserved || '—'}</td>
                    <td className="px-4 py-3">
                      {obs.behaviourFlags?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {obs.behaviourFlags.slice(0,2).map(f => (
                            <span key={f} className="bg-orange-100 text-orange-700 text-[11px] font-medium px-2 py-0.5 rounded-full">{f}</span>
                          ))}
                          {obs.behaviourFlags.length > 2 && <span className="text-[11px] text-slate-400">+{obs.behaviourFlags.length - 2}</span>}
                        </div>
                      ) : <span className="text-slate-400 text-xs">None</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {obs.sharedWith?.length > 0
                        ? obs.sharedWith.slice(0,2).map(u => u.name).join(', ')
                        : obs.sharedWithEmails?.[0] ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {obs.visitDate ? new Date(obs.visitDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', s.cls)}>
                        <Icon size={10} /> {s.label}
                      </span>
                      {obs.escalatedRequestId && (
                        <div className="mt-1">
                          <Link href={`/dashboard/requests/${typeof obs.escalatedRequestId === 'object' ? obs.escalatedRequestId._id : obs.escalatedRequestId}`}
                            className="text-[11px] text-purple-600 hover:underline">
                            {obs.escalatedRequestId?.requestNumber ?? 'View Request'}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {obs.status === 'DRAFT' && canRecommend && (
                          <button onClick={() => recommend(obs)} disabled={actId === obs._id}
                            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                              actId === obs._id
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200')}>
                            {actId === obs._id ? <RefreshCw size={10} className="animate-spin" /> : <AlertTriangle size={10} />}
                            {actId === obs._id ? 'Sending…' : '⚠ Recommend'}
                          </button>
                        )}
                        <Link href={`/dashboard/observations/${obs._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition">
                          View <ChevronRight size={10} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
