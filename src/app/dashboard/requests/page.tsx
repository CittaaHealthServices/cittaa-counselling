'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_DOT, formatDate } from '@/lib/utils'
import type { IRequest } from '@/types'

const STATUSES = ['ALL', 'PENDING_APPROVAL', 'APPROVED', 'PSYCHOLOGIST_ASSIGNED', 'SESSION_SCHEDULED',
  'SESSION_COMPLETED', 'ASSESSMENT_REQUESTED', 'ASSESSMENT_APPROVED', 'RCI_NOTIFIED',
  'RCI_VISITING', 'RCI_REPORT_SUBMITTED', 'CLOSED', 'REJECTED']

export default function RequestsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()

  const [requests, setRequests] = useState<IRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [status,   setStatus]   = useState(searchParams.get('status') || 'ALL')
  const [priority, setPriority] = useState(searchParams.get('priority') || '')
  const [search,   setSearch]   = useState('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (status && status !== 'ALL') params.set('status', status)
    if (priority) params.set('priority', priority)
    if (search)   params.set('search', search)

    const res = await fetch(`/api/requests?${params}`)
    const data = await res.json()
    setRequests(data.requests || [])
    setTotal(data.pagination?.total || 0)
    setPages(data.pagination?.pages || 1)
    setLoading(false)
  }, [page, status, priority, search])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const role = session?.user?.role
  const canCreate = ['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL'].includes(role || '')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Counselling Requests</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/requests/new" className="btn-primary">
            <Plus size={16} /> New Request
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'PENDING_APPROVAL', 'SESSION_SCHEDULED', 'ASSESSMENT_REQUESTED', 'RCI_NOTIFIED', 'CLOSED'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                status === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_LABELS[s as keyof typeof STATUS_LABELS] || s}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or request no."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="form-input pl-9"
            />
          </div>
          {/* Priority filter */}
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1) }}
            className="form-select w-40"
          >
            <option value="">All Priorities</option>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Filter size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No requests found</div>
            {canCreate && (
              <Link href="/dashboard/requests/new" className="mt-3 text-sm text-blue-600 hover:text-blue-800">
                Submit the first request →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Request No.</th>
                  <th>Student</th>
                  <th>Concern</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>School</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const student = r.student as any
                  const school  = r.school as any
                  return (
                    <tr key={r._id}>
                      <td className="font-mono text-xs text-slate-600">{r.requestNumber}</td>
                      <td>
                        <div className="font-medium text-slate-900">{student?.name}</div>
                        <div className="text-xs text-slate-400">{student?.class}{student?.section ? ` – ${student.section}` : ''}</div>
                      </td>
                      <td className="text-slate-600 max-w-40">
                        <div className="truncate">{r.concernCategory}</div>
                      </td>
                      <td>
                        <span className={cn('badge', PRIORITY_COLORS[r.priority])}>
                          <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', PRIORITY_DOT[r.priority])} />
                          {r.priority}
                        </span>
                      </td>
                      <td>
                        <span className={cn('badge', STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600')}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="text-slate-500 text-xs">{school?.name}</td>
                      <td className="text-slate-400 text-xs">{formatDate(r.createdAt)}</td>
                      <td>
                        <Link
                          href={`/dashboard/requests/${r._id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
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
          <div className="text-sm text-slate-500">
            Page {page} of {pages} · {total} requests
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
