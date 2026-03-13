'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, ClipboardList, User, School, FileText, CheckCircle2,
  XCircle, ChevronRight, Calendar, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED:         'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-700',
  IN_PROGRESS:      'bg-purple-100 text-purple-700',
  COMPLETED:        'bg-slate-100 text-slate-700',
}

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  PSYCHOLOGICAL:   'Psychological',
  EDUCATIONAL:     'Educational',
  BEHAVIOURAL:     'Behavioural',
  SPEECH_LANGUAGE: 'Speech & Language',
  OCCUPATIONAL:    'Occupational',
}

export default function AssessmentDetailPage() {
  const { id }            = useParams<{ id: string }>()
  const router            = useRouter()
  const { data: session } = useSession()
  const role              = session?.user?.role || ''

  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject]     = useState(false)
  const [rciNote, setRciNote]           = useState('')

  const isPrincipal    = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)
  const isCittaaAdmin  = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const isPsychologist = role === 'PSYCHOLOGIST'
  const canApprove     = isPrincipal && data?.status === 'PENDING_APPROVAL'
  const canAssignRCI   = isCittaaAdmin && data?.status === 'APPROVED' && !data?.rciReportId

  useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.assessment))
      .finally(() => setLoading(false))
  }, [id])

  async function handleApprove() {
    setSaving(true)
    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'approve' }),
      })
      const result = await res.json()
      if (res.ok) { toast.success('Assessment approved'); setData(result.assessment) }
      else toast.error(result.error || 'Failed')
    } finally { setSaving(false) }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'reject', rejectionReason: rejectReason }),
      })
      const result = await res.json()
      if (res.ok) { toast.success('Assessment rejected'); setData(result.assessment); setShowReject(false) }
      else toast.error(result.error || 'Failed')
    } finally { setSaving(false) }
  }

  async function handleAssignRCI() {
    setSaving(true)
    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'assign_rci', rciNote }),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('RCI team notified')
        setData(result.assessment)
        if (result.rciReport?._id) router.push(`/dashboard/rci/${result.rciReport._id}`)
      } else toast.error(result.error || 'Failed')
    } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        Assessment not found.{' '}
        <Link href="/dashboard/assessments" className="text-purple-600 hover:underline">Back</Link>
      </div>
    )
  }

  const student  = data.studentId      || {}
  const psych    = data.psychologistId || {}
  const school   = data.schoolId       || {}
  const request  = data.requestId      || {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Assessment Detail</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
            <Link href="/dashboard/assessments" className="hover:text-purple-600">Assessments</Link>
            <ChevronRight size={14} />
            <span>{data.requestNumber}</span>
          </div>
        </div>
        <span className={cn('badge', STATUS_COLORS[data.status] || 'bg-slate-100 text-slate-600')}>
          {data.status?.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Core details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-purple-600" /> Assessment Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400 text-xs font-medium mb-0.5">Request No.</div>
                <div className="font-mono font-semibold text-slate-800">{data.requestNumber}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium mb-0.5">Type</div>
                <div className="font-medium text-slate-800">
                  {ASSESSMENT_TYPE_LABELS[data.assessmentType] || data.assessmentType}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-slate-400 text-xs font-medium mb-0.5">Reason / Referral Notes</div>
                <div className="text-slate-700 leading-relaxed">{data.reason || '—'}</div>
              </div>
            </div>

            {request._id && (
              <div className="pt-3 border-t border-slate-100">
                <div className="text-slate-400 text-xs font-medium mb-1">Linked Counselling Request</div>
                <Link href={`/dashboard/requests/${request._id}`}
                  className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 text-sm font-medium">
                  <FileText size={14} />
                  {request.requestNumber || 'View Request'}
                  <ChevronRight size={13} />
                </Link>
              </div>
            )}

            {data.rciReportId && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-slate-400 text-xs font-medium mb-1">RCI Report</div>
                <Link href={`/dashboard/rci/${data.rciReportId._id || data.rciReportId}`}
                  className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                  View RCI Report
                  <ChevronRight size={13} />
                </Link>
              </div>
            )}
          </div>

          {/* Principal approval actions */}
          {canApprove && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-yellow-800 font-semibold">
                <AlertTriangle size={16} />
                Action Required — Awaiting Your Approval
              </div>
              <p className="text-sm text-yellow-700">
                Psychologist <strong>{psych.name}</strong> has requested a formal assessment for{' '}
                <strong>{student.name}</strong>. Please review and approve or reject.
              </p>
              {!showReject ? (
                <div className="flex gap-3">
                  <button onClick={handleApprove} disabled={saving}
                    className="btn-success flex-1 justify-center">
                    <CheckCircle2 size={15} /> Approve Assessment
                  </button>
                  <button onClick={() => setShowReject(true)}
                    className="btn-danger flex-1 justify-center">
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Provide reason for rejection..."
                    className="form-textarea w-full"
                  />
                  <div className="flex gap-3">
                    <button onClick={handleReject} disabled={saving || !rejectReason.trim()}
                      className="btn-danger flex-1 justify-center">
                      Confirm Rejection
                    </button>
                    <button onClick={() => setShowReject(false)} className="btn-secondary flex-1 justify-center">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rejection reason */}
          {data.status === 'REJECTED' && data.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="text-red-700 font-medium text-sm mb-1">Rejection Reason</div>
              <div className="text-red-600 text-sm">{data.rejectionReason}</div>
            </div>
          )}

          {/* Admin: Assign RCI */}
          {canAssignRCI && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
              <div className="text-indigo-800 font-semibold text-sm">
                Assign to RCI Team
              </div>
              <p className="text-sm text-indigo-700">
                This assessment has been approved. Assign an RCI team member to conduct a school visit.
              </p>
              <div>
                <label className="form-label">Additional Notes for RCI Team (optional)</label>
                <textarea value={rciNote} onChange={(e) => setRciNote(e.target.value)}
                  rows={2} className="form-textarea w-full"
                  placeholder="Any specific instructions for the RCI team visit..."
                />
              </div>
              <button onClick={handleAssignRCI} disabled={saving}
                className="btn-primary w-full justify-center">
                Notify RCI Team & Create Report
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <User size={15} className="text-purple-600" />
              </div>
              <div className="text-sm font-semibold text-slate-700">Student</div>
            </div>
            <div className="text-sm space-y-1">
              <div className="font-medium text-slate-900">{student.name || '—'}</div>
              {student.class && (
                <div className="text-slate-500">
                  Class {student.class}{student.section ? ` – ${student.section}` : ''}
                </div>
              )}
              {student.age && <div className="text-slate-400 text-xs">Age: {student.age}</div>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <User size={15} className="text-purple-600" />
              </div>
              <div className="text-sm font-semibold text-slate-700">Requested By</div>
            </div>
            <div className="text-sm space-y-1">
              <div className="font-medium text-slate-900">{psych.name || '—'}</div>
              <div className="text-slate-500 text-xs">{psych.email}</div>
            </div>
          </div>

          {school.name && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <School size={15} className="text-green-600" />
                </div>
                <div className="text-sm font-semibold text-slate-700">School</div>
              </div>
              <div className="text-sm">
                <div className="font-medium text-slate-900">{school.name}</div>
                {school.city && <div className="text-slate-500">{school.city}</div>}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" /> Timeline
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Requested</span>
                <span className="text-slate-700">{formatDate(data.createdAt)}</span>
              </div>
              {data.approvedAt && (
                <div className="flex justify-between">
                  <span>Approved</span>
                  <span className="text-green-600">{formatDate(data.approvedAt)}</span>
                </div>
              )}
              {data.rejectedAt && (
                <div className="flex justify-between">
                  <span>Rejected</span>
                  <span className="text-red-600">{formatDate(data.rejectedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
