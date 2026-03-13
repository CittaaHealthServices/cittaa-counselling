'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Search, Filter, ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, STATUS_LABELS, STATUS_COLORS, formatDate, formatDateTime } from '@/lib/utils'
import type { IAssessment } from '@/types'

export const dynamic = 'force-dynamic'

const RCI_STATUSES = ['ALL', 'NOTIFIED', 'VISIT_SCHEDULED', 'VISITING', 'REPORT_SUBMITTED']

function RCIContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()

  const [assessments, setAssessments] = useState<IAssessment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState(searchParams.get('status') || 'ALL')
  const [search, setSearch] = useState('')

  // Modals
  const [showReport, setShowReport] = useState(false)
  const [selectedAssessment, setSelectedAssessment] = useState<IAssessment | null>(null)
  const [visitDate, setVisitDate] = useState('')
  const [findings, setFindings] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const role = session?.user?.role
  const userId = session?.user?.id

  const fetchAssessments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })

    // For RCI_TEAM: show assessments assigned to them
    // For CITTAA_ADMIN: show all approved assessments with RCI status
    if (role === 'RCI_TEAM') {
      params.set('status', 'APPROVED')
      params.set('rciAssignedTo', userId || '')
    } else if (role === 'CITTAA_ADMIN') {
      params.set('status', 'APPROVED')
      if (status && status !== 'ALL') params.set('rciStatus', status)
    }

    if (search) params.set('search', search)

    const res = await fetch(`/api/assessments?${params}`)
    const data = await res.json()
    setAssessments(data.assessments || [])
    setTotal(data.pagination?.total || 0)
    setPages(data.pagination?.pages || 1)
    setLoading(false)
  }, [page, status, search, role, userId])

  useEffect(() => {
    fetchAssessments()
  }, [fetchAssessments])

  async function handleStatusUpdate(assessment: IAssessment, newStatus: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/rci/${assessment._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Status updated to ${newStatus}`)
        fetchAssessments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update status')
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSubmitReport() {
    if (!selectedAssessment || !visitDate || !findings) {
      toast.error('Please fill in all required fields')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/rci/${selectedAssessment._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitReport',
          visitDate,
          findings,
          recommendations,
        }),
      })
      if (res.ok) {
        toast.success('Report submitted successfully')
        setShowReport(false)
        setSelectedAssessment(null)
        setVisitDate('')
        setFindings('')
        setRecommendations('')
        fetchAssessments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to submit report')
      }
    } finally {
      setActionLoading(false)
    }
  }

  function openReportModal(assessment: IAssessment) {
    setSelectedAssessment(assessment)
    setShowReport(true)
  }

  const statusMap: Record<string, string> = {
    NOTIFIED: 'NOTIFIED',
    VISIT_SCHEDULED: 'VISIT_SCHEDULED',
    VISITING: 'VISITING',
    REPORT_SUBMITTED: 'REPORT_SUBMITTED',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">RCI Assignments</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {RCI_STATUSES.map((s) => (
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
        ) : assessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Filter size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No RCI assignments found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>School</th>
                  <th>RCI Status</th>
                  <th>Visit Date</th>
                  <th>Assigned To</th>
                  <th>{role === 'RCI_TEAM' ? 'Actions' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => {
                  const request = assessment.requestId as any
                  const student = request?.student as any
                  const school = request?.school as any
                  const rciReport = assessment.rciReport as any

                  const rciStatus = rciReport?.status || 'NOTIFIED'
                  const visitDateStr = rciReport?.visitDate

                  return (
                    <tr key={assessment._id}>
                      <td>
                        <div className="font-medium text-slate-900">{student?.name}</div>
                        <div className="text-xs text-slate-400">
                          {student?.class}{student?.section ? ` – ${student.section}` : ''}
                        </div>
                      </td>
                      <td className="text-slate-600 text-sm">{school?.name}</td>
                      <td>
                        <span
                          className={cn(
                            'badge',
                            rciStatus === 'REPORT_SUBMITTED'
                              ? 'bg-green-100 text-green-800'
                              : rciStatus === 'VISITING'
                                ? 'bg-blue-100 text-blue-800'
                                : rciStatus === 'VISIT_SCHEDULED'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-yellow-100 text-yellow-800'
                          )}
                        >
                          {rciStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-slate-600 text-sm">
                        {visitDateStr ? formatDate(visitDateStr) : '—'}
                      </td>
                      <td className="text-slate-600 text-sm">
                        {rciReport?.assignedTo?.name || 'Unassigned'}
                      </td>
                      <td className="text-sm space-x-2">
                        {role === 'RCI_TEAM' && rciStatus !== 'REPORT_SUBMITTED' ? (
                          <>
                            {rciStatus === 'NOTIFIED' && (
                              <button
                                onClick={() => handleStatusUpdate(assessment, 'VISIT_SCHEDULED')}
                                disabled={actionLoading}
                                className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-60"
                              >
                                Schedule Visit
                              </button>
                            )}
                            {rciStatus === 'VISIT_SCHEDULED' && (
                              <button
                                onClick={() => handleStatusUpdate(assessment, 'VISITING')}
                                disabled={actionLoading}
                                className="text-purple-600 hover:text-purple-800 font-medium disabled:opacity-60"
                              >
                                Start Visit
                              </button>
                            )}
                            {rciStatus === 'VISITING' && (
                              <button
                                onClick={() => openReportModal(assessment)}
                                disabled={actionLoading}
                                className="text-green-600 hover:text-green-800 font-medium disabled:opacity-60"
                              >
                                Submit Report
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500">{rciStatus.replace(/_/g, ' ')}</span>
                        )}
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
            Page {page} of {pages} · {total} assignments
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

      {/* Report Modal */}
      {showReport && selectedAssessment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Submit RCI Report</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Visit Date</label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="form-input w-full"
                />
              </div>

              <div>
                <label className="form-label">Findings *</label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Detailed findings from the visit..."
                  className="form-textarea w-full"
                  rows={5}
                />
              </div>

              <div>
                <label className="form-label">Recommendations</label>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Recommendations for the student's care and support..."
                  className="form-textarea w-full"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReport(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={actionLoading}
                className="btn-success flex-1 disabled:opacity-60"
              >
                {actionLoading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RCIPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <RCIContent />
    </Suspense>
  )
}
