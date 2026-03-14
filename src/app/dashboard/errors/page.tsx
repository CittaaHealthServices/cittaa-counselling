'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, Server, ShieldOff, Clock, CheckCircle2,
  RefreshCw, Filter, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// ── Colour maps ────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  API_CRASH:      'API Crash',
  FRONTEND_CRASH: 'Frontend Crash',
  AUTH_FAILURE:   'Auth Failure',
  SLOW_API:       'Slow Response',
}
const TYPE_COLOR: Record<string, string> = {
  API_CRASH:      'bg-red-100 text-red-700',
  FRONTEND_CRASH: 'bg-orange-100 text-orange-700',
  AUTH_FAILURE:   'bg-yellow-100 text-yellow-700',
  SLOW_API:       'bg-purple-100 text-purple-700',
}
const TYPE_ICON: Record<string, any> = {
  API_CRASH:      Server,
  FRONTEND_CRASH: AlertTriangle,
  AUTH_FAILURE:   ShieldOff,
  SLOW_API:       Clock,
}

export default function ErrorsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [errors, setErrors]       = useState<any[]>([])
  const [summary, setSummary]     = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage]           = useState(1)
  const [pages, setPages]         = useState(1)
  const [total, setTotal]         = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [resolvedFilter, setResolvedFilter] = useState('false')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [resolving, setResolving] = useState(false)
  const [expanded, setExpanded]   = useState<string | null>(null)

  const role = session?.user?.role
  useEffect(() => {
    if (session && !['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role || '')) {
      router.replace('/dashboard')
    }
  }, [session, role])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    const params = new URLSearchParams({ page: String(page), limit: '30' })
    if (typeFilter)    params.set('type', typeFilter)
    if (resolvedFilter !== '') params.set('resolved', resolvedFilter)
    const res  = await fetch(`/api/errors?${params}`)
    const data = await res.json()
    setErrors(data.errors || [])
    setSummary(data.summary || null)
    setTotal(data.pagination?.total || 0)
    setPages(data.pagination?.pages || 1)
    setLoading(false); setRefreshing(false)
  }, [page, typeFilter, resolvedFilter])

  useEffect(() => { load() }, [load])

  async function resolveSelected() {
    if (selected.size === 0) return
    setResolving(true)
    await fetch('/api/errors', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids: Array.from(selected) }),
    })
    setSelected(new Set())
    setResolving(false)
    load(true)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role || '')) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Error Monitor</h1>
          <p className="page-subtitle">Platform crashes, auth failures, and slow responses</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Today',      value: summary.todayCount, color: 'text-slate-900' },
            { label: 'Unresolved', value: summary.unresolved, color: summary.unresolved ? 'text-red-600' : 'text-green-600' },
            { label: 'Crashes',    value: summary.crashes,    color: summary.crashes    ? 'text-red-600' : 'text-slate-900' },
            { label: 'Auth Fails', value: summary.authFails,  color: summary.authFails  ? 'text-yellow-600' : 'text-slate-900' },
            { label: 'Slow APIs',  value: summary.slowApis,   color: summary.slowApis   ? 'text-purple-600' : 'text-slate-900' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className={cn('text-2xl font-bold', color)}>{value ?? 0}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="form-select w-44"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={resolvedFilter}
          onChange={(e) => { setResolvedFilter(e.target.value); setPage(1) }}
          className="form-select w-36"
        >
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>
        {selected.size > 0 && (
          <button
            onClick={resolveSelected}
            disabled={resolving}
            className="ml-auto btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 size={14} />
            {resolving ? 'Resolving…' : `Mark ${selected.size} resolved`}
          </button>
        )}
      </div>

      {/* Error list */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <CheckCircle2 size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No errors found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      onChange={(e) => setSelected(e.target.checked ? new Set(errors.map((x) => x._id)) : new Set())}
                      checked={selected.size === errors.length && errors.length > 0}
                    />
                  </th>
                  <th>Type</th>
                  <th>Route</th>
                  <th>Message</th>
                  <th>User</th>
                  <th>Duration</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err) => {
                  const Icon = TYPE_ICON[err.type] ?? AlertTriangle
                  const isOpen = expanded === err._id
                  return (
                    <>
                      <tr key={err._id} className={cn(err.isResolved && 'opacity-50')}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(err._id)}
                            onChange={() => toggleSelect(err._id)}
                          />
                        </td>
                        <td>
                          <span className={cn('badge flex items-center gap-1', TYPE_COLOR[err.type])}>
                            <Icon size={11} />
                            {TYPE_LABEL[err.type] ?? err.type}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-600 max-w-40 truncate">
                          {err.method && <span className="text-slate-400 mr-1">{err.method}</span>}
                          {err.route}
                        </td>
                        <td className="text-xs text-slate-600 max-w-52 truncate">{err.message}</td>
                        <td className="text-xs text-slate-500">
                          {err.userEmail
                            ? <><div>{err.userEmail}</div><div className="text-slate-400">{err.userRole}</div></>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="text-xs text-slate-500">
                          {err.durationMs ? `${err.durationMs}ms` : '—'}
                        </td>
                        <td className="text-xs text-slate-400">{formatDateTime(err.createdAt)}</td>
                        <td>
                          {err.isResolved
                            ? <span className="badge bg-green-100 text-green-700">Resolved</span>
                            : <span className="badge bg-red-100 text-red-600">Open</span>}
                        </td>
                        <td>
                          <button
                            onClick={() => setExpanded(isOpen ? null : err._id)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${err._id}-detail`}>
                          <td colSpan={9} className="bg-slate-50 px-4 py-3">
                            <div className="space-y-2 text-xs">
                              {err.ipAddress && <div><span className="text-slate-400">IP:</span> <span className="font-mono">{err.ipAddress}</span></div>}
                              {err.userAgent && <div><span className="text-slate-400">UA:</span> <span className="text-slate-600 break-all">{err.userAgent}</span></div>}
                              {err.metadata && (
                                <div>
                                  <span className="text-slate-400">Metadata:</span>
                                  <pre className="mt-1 bg-slate-100 rounded p-2 text-slate-700 overflow-x-auto text-xs">
                                    {JSON.stringify(err.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {err.stack && (
                                <div>
                                  <span className="text-slate-400">Stack:</span>
                                  <pre className="mt-1 bg-slate-900 text-green-300 rounded p-3 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap break-all">
                                    {err.stack}
                                  </pre>
                                </div>
                              )}
                              {err.isResolved && (
                                <div className="text-green-600">
                                  Resolved by {err.resolvedBy} at {formatDateTime(err.resolvedAt)}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">Page {page} of {pages} · {total} errors</div>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary btn-sm disabled:opacity-40"><ChevronLeft size={14} /> Prev</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="btn-secondary btn-sm disabled:opacity-40">Next <ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
