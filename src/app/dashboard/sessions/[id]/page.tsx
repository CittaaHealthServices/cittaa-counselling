'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Clock, User, School, FileText,
  CheckCircle2, XCircle, RefreshCw, Save, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-blue-100 text-blue-700',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-yellow-100 text-yellow-700',
}
const MODE_LABELS: Record<string, string> = {
  IN_PERSON:   'In Person',
  VIDEO_CALL:  'Video Call',
  PHONE_CALL:  'Phone Call',
}

export default function SessionDetailPage() {
  const { id }           = useParams<{ id: string }>()
  const router           = useRouter()
  const { data: session } = useSession()
  const role             = session?.user?.role || ''

  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  // Editable fields
  const [status, setStatus]             = useState('')
  const [sessionNotes, setNotes]        = useState('')
  const [followUpRequired, setFollowUp] = useState(false)
  const [nextSessionDate, setNextDate]  = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const isPsychologist = role === 'PSYCHOLOGIST'
  const isAdmin        = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const canEdit        = isPsychologist || isAdmin

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.session)
        setStatus(d.session?.status || '')
        setNotes(d.session?.sessionNotes || '')
        setFollowUp(d.session?.followUpRequired || false)
        setNextDate(d.session?.nextSessionDate ? d.session.nextSessionDate.split('T')[0] : '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { status, sessionNotes, followUpRequired }
      if (nextSessionDate) body.nextSessionDate = nextSessionDate
      if (status === 'CANCELLED' && cancelReason) body.cancelReason = cancelReason

      const res  = await fetch(`/api/sessions/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('Session updated')
        setData(result.session)
      } else {
        toast.error(result.error || 'Update failed')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        Session not found.{' '}
        <Link href="/dashboard/sessions" className="text-blue-600 hover:underline">Back to sessions</Link>
      </div>
    )
  }

  const student  = data.studentId  || {}
  const request  = data.requestId  || {}
  const psych    = data.psychologistId || {}
  const school   = data.schoolId   || {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Session Detail</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
            <Link href="/dashboard/sessions" className="hover:text-blue-600">Sessions</Link>
            <ChevronRight size={14} />
            <span>{formatDate(data.scheduledAt)}</span>
          </div>
        </div>
        <span className={cn('badge', STATUS_COLORS[data.status] || 'bg-slate-100 text-slate-600')}>
          {data.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — session info */}
        <div className="lg:col-span-2 space-y-5">

          {/* Core info card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" /> Session Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400 text-xs font-medium mb-0.5">Scheduled At</div>
                <div className="font-medium text-slate-800">{formatDate(data.scheduledAt)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium mb-0.5">Duration</div>
                <div className="font-medium text-slate-800">{data.duration || 45} minutes</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium mb-0.5">Mode</div>
                <div className="font-medium text-slate-800">{MODE_LABELS[data.mode] || data.mode || 'In Person'}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium mb-0.5">Status</div>
                <span className={cn('badge text-xs', STATUS_COLORS[data.status] || 'bg-slate-100 text-slate-600')}>
                  {data.status}
                </span>
              </div>
            </div>

            {request._id && (
              <div className="pt-3 border-t border-slate-100">
                <div className="text-slate-400 text-xs font-medium mb-1">Linked Request</div>
                <Link href={`/dashboard/requests/${request._id}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium">
                  <FileText size={14} />
                  {request.requestNumber || 'View Request'}
                  <ChevronRight size={13} />
                </Link>
              </div>
            )}
          </div>

          {/* Session notes (editable for psychologist) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" /> Session Notes
            </h2>
            {canEdit ? (
              <textarea
                value={sessionNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Record session observations, student responses, and key takeaways here..."
                className="form-textarea w-full"
              />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {data.sessionNotes || <span className="text-slate-400 italic">No notes recorded yet</span>}
              </p>
            )}

            {canEdit && (
              <>
                {/* Follow-up toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFollowUp(!followUpRequired)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                      followUpRequired
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {followUpRequired ? <CheckCircle2 size={15} /> : <RefreshCw size={15} />}
                    {followUpRequired ? 'Follow-up Required' : 'Mark Follow-up Required'}
                  </button>
                </div>

                {followUpRequired && (
                  <div>
                    <label className="form-label">Next Session Date (optional)</label>
                    <input type="date" value={nextSessionDate}
                      onChange={(e) => setNextDate(e.target.value)}
                      className="form-input max-w-xs"
                    />
                  </div>
                )}

                {/* Status update */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="form-label">Update Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select">
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="RESCHEDULED">Rescheduled</option>
                    </select>
                  </div>
                  {status === 'CANCELLED' && (
                    <div>
                      <label className="form-label">Cancellation Reason</label>
                      <input type="text" value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancellation"
                        className="form-input"
                      />
                    </div>
                  )}
                </div>

                <button onClick={handleSave} disabled={saving}
                  className="btn-primary w-full justify-center">
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <><Save size={15} /> Save Changes</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right column — people + school */}
        <div className="space-y-4">
          {/* Student */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={15} className="text-blue-600" />
              </div>
              <div className="text-sm font-semibold text-slate-700">Student</div>
            </div>
            <div className="text-sm space-y-1">
              <div className="font-medium text-slate-900">{student.name || '—'}</div>
              {student.class && (
                <div className="text-slate-500">Class {student.class}{student.section ? ` – ${student.section}` : ''}</div>
              )}
              {student.rollNumber && <div className="text-slate-400 text-xs">Roll: {student.rollNumber}</div>}
            </div>
          </div>

          {/* Psychologist */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <User size={15} className="text-purple-600" />
              </div>
              <div className="text-sm font-semibold text-slate-700">Psychologist</div>
            </div>
            <div className="text-sm space-y-1">
              <div className="font-medium text-slate-900">{psych.name || '—'}</div>
              <div className="text-slate-500 text-xs">{psych.email}</div>
            </div>
          </div>

          {/* School */}
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
                {school.city && <div className="text-slate-500">{school.city}, {school.state}</div>}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock size={14} className="text-slate-400" /> Timeline
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Created</span>
                <span className="font-medium text-slate-700">{formatDate(data.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Scheduled</span>
                <span className="font-medium text-slate-700">{formatDate(data.scheduledAt)}</span>
              </div>
              {data.followUpRequired && data.nextSessionDate && (
                <div className="flex justify-between">
                  <span>Next Session</span>
                  <span className="font-medium text-blue-600">{formatDate(data.nextSessionDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
