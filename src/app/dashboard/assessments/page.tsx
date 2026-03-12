'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Filter, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, STATUS_LABELS, STATUS_COLORS, formatDate } from '@/lib/utils'
import type { IAssessment } from '@/types'

const STATUSES = ['ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED']

export default function AssessmentsPage() {
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
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [selectedAssessment, setSelectedAssessment] = useState<IAssessment | null>(null)
  const [rciMembers, setRciMembers] = useState<any[]>([])
  const [selectedRciMember, setSelectedRciMember] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchAssessments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (status && status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)

    const res = await fetch(`/api/assessments?${params}`)
    const data = await res.json()
    setAssessments(data.assessments || [])
    setTotal(data.pagination?.total || 0)
    setPages(data.pagination?.pages || 1)
    setLoading(false)
  }, [page, status, search])

  useEffect(() => {
    fetchAssessments()
  }, [fetchAssessments])

  async function fetchRciMembers() {
    try {
      const res = await fetch('/api/users?role=RCI_TEAM')
      const data = await res.json()
      setRciMembers(data.users || [])
    } catch (err) {
      toast.error('Failed to load RCI team members')
    }
  }

  async function handleApprove() {
    if (!selectedAssessment || !selectedRciMember) {
      toast.error('Please select an RCI team member')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/assessments/${selectedAssessment._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', rciMemberId: selectedRciMember }),
      })
      if (res.ok) {
        toast.success('Assessment approved and RCI team notified')
        setShowApprove(false)
        setSelectedAssessment(null)
        setSelectedRciMember('')
        fetchAssessments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to approve')
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!selectedAssessment || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/assessments/${selectedAssessment._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      })
      if (res.ok) {
        toast.success('Assessment rejected')
        setShowReject(false)
        setSelectedAssessment(null)
        setRejectReason('')
        fetchAssessments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to reject')
      }
    } finally {
      setActionLoading(false)
    }
  }

  function openApproveModal(assessment: IAssessment) {
    setSelectedAssessment(assessment)
    fetchRciMembers()
    setShowApprove(true)
  }

  function openRejectModal(assessment: IAssessment) {
    setSelectedAssessment(assessment)
    setShowReject(true)
  }

  const role = session?.user?.role
  const canApproveOrReject = ['SCHOOL_PRINCIPAL', 'CITTAA_ADMIN'].includes(role || '')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Assessments</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
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
              {s === 'ALL' ? 'All' : STATUS_LABELS[s as keyof typeof STATUS_LABELS] || s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name..."
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
            <div className="text-sm">No assessments found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Student</th>
                  <th>School</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  <th>Date</th>
                  {canApproveOrReject && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => {
                  const request = assessment.requestId as any
                  const student = request?.student as any
                  const school = request?.school as any
                  const requestedBy = assessment.requestedBy as any

                  return (
                    <tr key={assessment._id}>
                      <td className="font-medium text-slate-900">{assessment.type}</td>
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
                            STATUS_COLORS[assessment.status as keyof typeof STATUS_COLORS] ||
                              'bg-gray-100 text-gray-600'
                          )}
                        >
                          {STATUS_LABELS[assessment.status as keyof typeof STATUS_LABELS] ||
                            assessment.status}
                        </span>
                      </td>
                      <td className="text-slate-600 text-sm">{requestedBy?.name}</td>
                      <td className="text-slate-400 text-xs">{formatDate(assessment.createdAt)}</td>
                      {canApproveOrReject && assessment.status === 'PENDING_APPROVAL' && (
                        <td className="space-x-2">
                          <button
                            onClick={() => openApproveModal(assessment)}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            <CheckCircle size={16} className="inline mr-1" /> Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(assessment)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            <XCircle size={16} className="inline mr-1" /> Reject
                          </button>
                        </td>
                      )}
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
            Page {page} of {pages} · {total} assessments
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

      {/* Approve Modal */}
      {showApprove && selectedAssessment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Approve Assessment</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">RCI Team Member</label>
                <select
                  value={selectedRciMember}
                  onChange={(e) => setSelectedRciMember(e.target.value)}
                  className="form-select w-full"
                >
                  <option value="">Select a team member...</option>
                  {rciMembers.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApprove(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn-success flex-1 disabled:opacity-60"
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && selectedAssessment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Reject Assessment</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Reason for Rejection</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this assessment..."
                  className="form-textarea w-full"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReject(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="btn-danger flex-1 disabled:opacity-60"
              >
                {actionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
