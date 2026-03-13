'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle, XCircle, UserPlus, Calendar, Clock, AlertTriangle, Lock,
  ChevronDown, ChevronUp, Clipboard, FolderX,
} from 'lucide-react'
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_DOT, formatDateTime, ROLE_LABELS } from '@/lib/utils'
import { ASSESSMENT_TYPES } from '@/models/Assessment'

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const router = useRouter()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Action modals
  const [showApprove,   setShowApprove]   = useState(false)
  const [showReject,    setShowReject]    = useState(false)
  const [showAssign,    setShowAssign]    = useState(false)
  const [showSession,   setShowSession]   = useState(false)
  const [showAssessment,setShowAssessment]= useState(false)
  const [showComplete,  setShowComplete]  = useState(false)
  const [showClose,     setShowClose]     = useState(false)
  const [showHistory,   setShowHistory]   = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Form states
  const [closingNote,        setClosingNote]         = useState('')
  const [rejectReason,       setRejectReason]       = useState('')
  const [psychologists,      setPsychologists]      = useState<any[]>([])
  const [selectedPsych,      setSelectedPsych]      = useState('')
  const [substituteReason,   setSubstituteReason]   = useState('')
  const [sessionDate,        setSessionDate]        = useState('')
  const [sessionNotes,       setSessionNotes]       = useState('')
  const [assessmentType,     setAssessmentType]     = useState('')
  const [assessmentReason,   setAssessmentReason]   = useState('')
  const [sessionReport,      setSessionReport]      = useState('')
  const [followUp,           setFollowUp]           = useState(false)

  const role = session?.user?.role

  useEffect(() => { loadData() }, [params.id])
  useEffect(() => {
    if (showAssign) {
      fetch('/api/users?role=PSYCHOLOGIST')
        .then((r) => r.json())
        .then((d) => setPsychologists(d.users || []))
    }
  }, [showAssign])

  async function loadData() {
    setLoading(true)
    const res = await fetch(`/api/requests/${params.id}`)
    const d   = await res.json()
    setData(d)
    setLoading(false)
  }

  async function handleApprove() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/requests/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (res.ok) { toast.success('Request approved'); setShowApprove(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed') }
    } finally { setActionLoading(false) }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Please provide a reason'); return }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/requests/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      })
      if (res.ok) { toast.success('Request rejected'); setShowReject(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed') }
    } finally { setActionLoading(false) }
  }

  async function handleAssign() {
    if (!selectedPsych) { toast.error('Select a psychologist'); return }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/requests/${params.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psychologistId: selectedPsych, substituteReason }),
      })
      if (res.ok) { toast.success('Psychologist assigned'); setShowAssign(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed') }
    } finally { setActionLoading(false) }
  }

  async function handleScheduleSession() {
    if (!sessionDate) { toast.error('Select a date and time'); return }
    setActionLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: params.id, scheduledAt: sessionDate, notes: sessionNotes }),
      })
      if (res.ok) { toast.success('Session scheduled'); setShowSession(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed') }
    } finally { setActionLoading(false) }
  }

  async function handleRequestAssessment() {
    if (!assessmentType || !assessmentReason.trim()) { toast.error('Fill all fields'); return }
    setActionLoading(true)
    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: params.id, type: assessmentType, reason: assessmentReason }),
      })
      if (res.ok) { toast.success('Assessment request sent for approval'); setShowAssessment(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed') }
    } finally { setActionLoading(false) }
  }

  async function handleCloseCase() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/requests/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', closingNote }),
      })
      if (res.ok) { toast.success('Case closed successfully'); setShowClose(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed to close case') }
    } finally { setActionLoading(false) }
  }

  async function handleCompleteSession() {
    const session_id = data?.sessions?.[0]?._id
    if (!session_id) { toast.error('No session found'); return }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', sessionReport, followUpRequired: followUp }),
      })
      if (res.ok) { toast.success('Session marked complete'); setShowComplete(false); loadData() }
      else { const d = await res.json(); toast.error(d.error || 'Failed') }
    } finally { setActionLoading(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
  }
  if (!data?.request) return <div className="text-center text-slate-500 py-20">Request not found</div>

  const { request, sessions, assessments, rciReports } = data
  const student   = request.studentId
  const school    = request.schoolId
  const submitter = request.submittedById
  const assignedPsych = request.assignedPsychologistId
  const substitute    = request.substitutePsychologistId

  // What actions are available?
  const canApprove     = ['SCHOOL_PRINCIPAL', 'CITTAA_ADMIN'].includes(role || '') && request.status === 'PENDING_APPROVAL'
  const canAssign      = role === 'CITTAA_ADMIN' && request.status === 'APPROVED'
  // Psychologist can schedule on first assignment or for a follow-up after session completed
  const canSchedule    = role === 'PSYCHOLOGIST' && ['PSYCHOLOGIST_ASSIGNED', 'SESSION_COMPLETED'].includes(request.status)
  const canComplete    = role === 'PSYCHOLOGIST' && request.status === 'SESSION_SCHEDULED'
  const canReqAssess   = role === 'PSYCHOLOGIST' && request.status === 'SESSION_COMPLETED'
  const viewAssessments= ['PSYCHOLOGIST', 'SCHOOL_PRINCIPAL', 'CITTAA_ADMIN', 'SCHOOL_ADMIN'].includes(role || '')
  const CLOSABLE_STATUSES = ['SESSION_COMPLETED', 'ASSESSMENT_REJECTED', 'RCI_REPORT_SUBMITTED', 'APPROVED', 'PSYCHOLOGIST_ASSIGNED']
  const canClose       = ['CITTAA_ADMIN', 'SCHOOL_PRINCIPAL'].includes(role || '') &&
    CLOSABLE_STATUSES.includes(request.status)

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/requests" className="text-slate-400 hover:text-slate-600 mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{request.requestNumber}</h1>
            <span className={cn('badge', STATUS_COLORS[request.status] || 'bg-gray-100 text-gray-600')}>
              {STATUS_LABELS[request.status] || request.status}
            </span>
            <span className={cn('badge', PRIORITY_COLORS[request.priority])}>
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1', PRIORITY_DOT[request.priority])} />
              {request.priority}
            </span>
            {request.isConfidential && (
              <span className="badge bg-slate-100 text-slate-600"><Lock size={11} className="mr-1" />Confidential</span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">Submitted {formatDateTime(request.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Student info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Student Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Name" value={student?.name} />
              <InfoRow label="Class / Section" value={`${student?.class}${student?.section ? ` – ${student.section}` : ''}`} />
              <InfoRow label="Roll Number" value={student?.rollNumber || '—'} />
              <InfoRow label="Age" value={student?.age ? `${student.age} yrs` : '—'} />
              <InfoRow label="Gender" value={student?.gender || '—'} />
              <InfoRow label="Parent" value={student?.parentName || '—'} />
              <InfoRow label="Parent Phone" value={student?.parentPhone || '—'} />
            </div>
          </div>

          {/* Concern */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Concern Details</h2>
            <div className="mb-3">
              <span className="badge bg-orange-100 text-orange-700">{request.concernCategory}</span>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{request.description}</p>
            {request.rejectionReason && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <strong>Rejection reason:</strong> {request.rejectionReason}
              </div>
            )}
          </div>

          {/* Sessions */}
          {sessions?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Sessions</h2>
              <div className="space-y-3">
                {sessions.map((s: any) => (
                  <div key={s._id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm text-slate-900">{formatDateTime(s.scheduledAt)}</div>
                      <span className={cn('badge text-xs',
                        s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        s.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      )}>{s.status}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Psychologist: {s.psychologistId?.name}
                      {s.substituteId && <span className="ml-2 text-orange-600">(Substitute: {s.substituteId.name})</span>}
                    </div>
                    {s.sessionReport && (
                      <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
                        <div className="text-xs font-medium text-slate-400 mb-1">Session Notes</div>
                        {s.sessionReport}
                      </div>
                    )}
                    {s.followUpRequired && (
                      <div className="mt-2 text-xs text-orange-600 font-medium">⚠ Follow-up session recommended</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assessments */}
          {viewAssessments && assessments?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Assessment Requests</h2>
              {assessments.map((a: any) => (
                <div key={a._id} className="border border-slate-200 rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{a.type}</div>
                    <Link href={`/dashboard/assessments/${a._id}`} className="text-xs text-blue-600 hover:text-blue-800">View →</Link>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    Requested by {a.requestedById?.name} · {formatDateTime(a.createdAt)}
                  </div>
                  <span className={cn('badge text-xs',
                    a.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    a.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  )}>{a.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status history (collapsible) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="font-semibold text-slate-900">Status History</h2>
              {showHistory ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {showHistory && (
              <div className="mt-4 space-y-3">
                {[...request.statusHistory].reverse().map((h: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5" />
                      {i < request.statusHistory.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <div className="text-sm font-medium text-slate-900">
                        {STATUS_LABELS[h.status] || h.status}
                      </div>
                      {h.note && <div className="text-xs text-slate-500 mt-0.5">{h.note}</div>}
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatDateTime(h.timestamp)} · {h.changedBy?.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar info + actions */}
        <div className="space-y-4">
          {/* School */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-3">School</div>
            <div className="font-semibold text-slate-900">{school?.name}</div>
            <div className="text-xs text-slate-500 mt-1">{school?.city}, {school?.state}</div>
            <div className="text-xs text-slate-500">{school?.phone}</div>
          </div>

          {/* Submitted by */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Submitted By</div>
            <div className="font-semibold text-slate-900">{request.isConfidential && !['CITTAA_ADMIN', 'SCHOOL_PRINCIPAL'].includes(role || '') ? 'Confidential' : submitter?.name}</div>
            <div className="text-xs text-slate-500 mt-1">{ROLE_LABELS[submitter?.role] || submitter?.role}</div>
          </div>

          {/* Assigned psychologist */}
          {assignedPsych && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Psychologist</div>
              <div className="font-semibold text-slate-900">{assignedPsych.name}</div>
              <div className="text-xs text-slate-500 mt-1">{assignedPsych.email}</div>
              {substitute && (
                <div className="mt-2 text-xs text-orange-600 font-medium">
                  Substitute: {substitute.name}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Actions</div>

            {canApprove && (
              <>
                <button onClick={() => setShowApprove(true)} className="btn-success w-full justify-center">
                  <CheckCircle size={15} /> Approve Request
                </button>
                <button onClick={() => setShowReject(true)} className="btn-danger w-full justify-center">
                  <XCircle size={15} /> Reject Request
                </button>
              </>
            )}

            {canAssign && (
              <button onClick={() => setShowAssign(true)} className="btn-primary w-full justify-center">
                <UserPlus size={15} /> Assign Psychologist
              </button>
            )}

            {canSchedule && (
              <button onClick={() => setShowSession(true)} className="btn-primary w-full justify-center">
                <Calendar size={15} /> Schedule Session
              </button>
            )}

            {canComplete && (
              <button onClick={() => setShowComplete(true)} className="btn-success w-full justify-center">
                <CheckCircle size={15} /> Complete Session
              </button>
            )}

            {canReqAssess && (
              <button onClick={() => setShowAssessment(true)} className="btn-primary w-full justify-center">
                <Clipboard size={15} /> Request Assessment
              </button>
            )}

            {canClose && (
              <button onClick={() => setShowClose(true)} className="btn-secondary w-full justify-center border-red-200 text-red-600 hover:bg-red-50">
                <FolderX size={15} /> Close Case
              </button>
            )}

            {!canApprove && !canAssign && !canSchedule && !canComplete && !canReqAssess && !canClose && (
              <p className="text-xs text-slate-400 text-center py-2">No actions available for current status</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Approve confirm */}
      <Modal open={showApprove} onClose={() => setShowApprove(false)} title="Approve Request">
        <p className="text-sm text-slate-600 mb-4">
          Approving this request will notify the Cittaa team to assign a psychologist.
        </p>
        <div className="flex gap-3">
          <button onClick={handleApprove} disabled={actionLoading} className="btn-success flex-1 justify-center">
            {actionLoading ? 'Processing…' : 'Yes, Approve'}
          </button>
          <button onClick={() => setShowApprove(false)} className="btn-secondary">Cancel</button>
        </div>
      </Modal>

      {/* Reject */}
      <Modal open={showReject} onClose={() => setShowReject(false)} title="Reject Request">
        <div className="mb-4">
          <label className="form-label">Reason for rejection <span className="text-red-500">*</span></label>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="form-textarea" rows={3} placeholder="Provide a clear reason…" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleReject} disabled={actionLoading} className="btn-danger flex-1 justify-center">
            {actionLoading ? 'Processing…' : 'Reject'}
          </button>
          <button onClick={() => setShowReject(false)} className="btn-secondary">Cancel</button>
        </div>
      </Modal>

      {/* Assign psychologist */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Psychologist">
        <div className="space-y-4">
          <div>
            <label className="form-label">Select Psychologist</label>
            <select value={selectedPsych} onChange={(e) => setSelectedPsych(e.target.value)} className="form-select">
              <option value="">— Choose psychologist —</option>
              {psychologists.map((p: any) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.isAvailable ? '✓ Available' : '⚠ Unavailable'}
                </option>
              ))}
            </select>
          </div>
          {selectedPsych && !psychologists.find((p: any) => p._id === selectedPsych)?.isAvailable && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              <AlertTriangle size={14} className="inline mr-1.5" />
              This psychologist is marked unavailable. They will be assigned as a substitute.
              <div className="mt-2">
                <input value={substituteReason} onChange={(e) => setSubstituteReason(e.target.value)}
                  className="form-input text-xs" placeholder="Reason for substitute assignment" />
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleAssign} disabled={actionLoading || !selectedPsych} className="btn-primary flex-1 justify-center">
              {actionLoading ? 'Assigning…' : 'Assign'}
            </button>
            <button onClick={() => setShowAssign(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Schedule session */}
      <Modal open={showSession} onClose={() => setShowSession(false)} title="Schedule Session">
        <div className="space-y-4">
          <div>
            <label className="form-label">Date & Time <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Pre-session Notes</label>
            <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} className="form-textarea" rows={3} placeholder="Notes for your preparation…" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleScheduleSession} disabled={actionLoading} className="btn-primary flex-1 justify-center">
              {actionLoading ? 'Scheduling…' : 'Confirm Schedule'}
            </button>
            <button onClick={() => setShowSession(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Complete session */}
      <Modal open={showComplete} onClose={() => setShowComplete(false)} title="Complete Session">
        <div className="space-y-4">
          <div>
            <label className="form-label">Session Observations / Report</label>
            <textarea value={sessionReport} onChange={(e) => setSessionReport(e.target.value)} className="form-textarea" rows={5} placeholder="Summarise the session, student's state, key insights…" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="followup" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <label htmlFor="followup" className="text-sm text-slate-700">Follow-up session recommended</label>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCompleteSession} disabled={actionLoading} className="btn-success flex-1 justify-center">
              {actionLoading ? 'Saving…' : 'Mark as Completed'}
            </button>
            <button onClick={() => setShowComplete(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Close case */}
      <Modal open={showClose} onClose={() => setShowClose(false)} title="Close This Case">
        <p className="text-sm text-slate-600 mb-4">
          Closing this case will mark it as <strong>Closed</strong> and notify the submitter. This action cannot be undone.
        </p>
        <div className="mb-4">
          <label className="form-label">Closing Note (optional)</label>
          <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)}
            className="form-textarea" rows={3}
            placeholder="e.g. Student situation resolved, case closed by admin…" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleCloseCase} disabled={actionLoading}
            className="flex-1 justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            {actionLoading ? 'Closing…' : <><FolderX size={15} /> Close Case</>}
          </button>
          <button onClick={() => setShowClose(false)} className="btn-secondary">Cancel</button>
        </div>
      </Modal>

      {/* Request assessment */}
      <Modal open={showAssessment} onClose={() => setShowAssessment(false)} title="Request Formal Assessment">
        <div className="space-y-4">
          <div>
            <label className="form-label">Assessment Type <span className="text-red-500">*</span></label>
            <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)} className="form-select">
              <option value="">Select type</option>
              {ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Reason / Clinical Justification <span className="text-red-500">*</span></label>
            <textarea value={assessmentReason} onChange={(e) => setAssessmentReason(e.target.value)} className="form-textarea" rows={4} placeholder="Explain why this formal assessment is needed based on session observations…" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleRequestAssessment} disabled={actionLoading} className="btn-primary flex-1 justify-center">
              {actionLoading ? 'Sending…' : 'Send for Approval'}
            </button>
            <button onClick={() => setShowAssessment(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-slate-400 font-medium">{label}</div>
      <div className="text-slate-800 font-medium mt-0.5">{value || '—'}</div>
    </div>
  )
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
