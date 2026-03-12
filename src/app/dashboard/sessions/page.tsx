'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter, ChevronLeft, ChevronRight, Calendar, User, MapPin } from 'lucide-react'
import { cn, STATUS_LABELS, STATUS_COLORS, formatDateTime, formatDate } from '@/lib/utils'
import type { ISession } from '@/types'

const SESSION_STATUSES = ['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED']

export default function SessionsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()

  const [sessions, setSessions] = useState<ISession[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState(searchParams.get('status') || 'ALL')
  const [search, setSearch] = useState('')

  const role = session?.user?.role
  const userId = session?.user?.id

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })

    // For PSYCHOLOGIST: show their sessions sorted by date
    if (role === 'PSYCHOLOGIST') {
      params.set('psychologistId', userId || '')
    }

    if (status && status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/sessions?${params}`)
      const data = await res.json()
      setSessions(data.sessions || [])
      setTotal(data.pagination?.total || 0)
      setPages(data.pagination?.pages || 1)
    } catch (err) {
      console.error('Failed to load sessions', err)
    }
    setLoading(false)
  }, [page, status, search, role, userId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'RESCHEDULED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  const isUpcoming = (scheduledAt: string) => {
    return new Date(scheduledAt) > new Date()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {SESSION_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s)
                setPage(1)
              }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                status === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or school..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="form-input pl-9 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Filter size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No sessions found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Scheduled Time</th>
                  <th>Student</th>
                  <th>School</th>
                  <th>Psychologist</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => {
                  const request = sess.requestId as any
                  const student = request?.student as any
                  const school = request?.school as any
                  const psychologist = sess.psychologist as any

                  return (
                    <tr key={sess._id} className={isUpcoming(sess.scheduledAt) && sess.status === 'SCHEDULED' ? 'bg-blue-50' : ''}>
                      <td>
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {formatDateTime(sess.scheduledAt)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {sess.durationMinutes ? `${sess.durationMinutes} min` : ''}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          {student?.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {student?.class}{student?.section ? ` – ${student.section}` : ''}
                        </div>
                      </td>
                      <td className="text-slate-600 text-sm flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {school?.name}
                      </td>
                      <td className="text-slate-600 text-sm">{psychologist?.name || '—'}</td>
                      <td>
                        <span className={cn('badge', getStatusColor(sess.status))}>
                          {sess.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/requests/${request?._id}`}
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
            Page {page} of {pages} · {total} sessions
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
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
