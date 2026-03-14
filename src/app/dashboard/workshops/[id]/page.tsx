'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit3, Check, X, Loader2, Calendar, Users,
  MapPin, Wifi, Monitor, Star, AlertTriangle, CheckCircle2,
  Clock, BookOpen, FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  PLANNED:   'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  POSTPONED: 'bg-orange-100 text-orange-700',
}

const NEXT_STATUSES: Record<string, string[]> = {
  PLANNED:   ['CONFIRMED', 'POSTPONED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['PLANNED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export default function WorkshopDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [workshop, setWorkshop] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [editing, setEditing]   = useState(false)
  const [showOutcome, setShowOutcome] = useState(false)
  const [error, setError]       = useState('')

  // Outcome form state
  const [outcome, setOutcome] = useState({
    actualDate: '', actualAttendance: '', feedbackScore: '',
    keyObservations: '', followUpRequired: false, followUpNotes: '',
  })

  const role = session?.user?.role || ''
  const canEdit = ['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'PSYCHOLOGIST'].includes(role)

  useEffect(() => {
    fetch(`/api/workshops/${params.id}`)
      .then(r => r.json())
      .then(d => {
        setWorkshop(d.workshop)
        if (d.workshop?.actualDate) {
          const w = d.workshop
          setOutcome({
            actualDate:      w.actualDate ? w.actualDate.split('T')[0] : '',
            actualAttendance: String(w.actualAttendance || ''),
            feedbackScore:   String(w.feedbackScore || ''),
            keyObservations: w.keyObservations || '',
            followUpRequired: w.followUpRequired || false,
            followUpNotes:   w.followUpNotes || '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [params.id])

  async function updateStatus(status: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/workshops/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const data = await res.json()
        setWorkshop(data.workshop)
        if (status === 'COMPLETED') setShowOutcome(true)
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveOutcome(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/workshops/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:           'COMPLETED',
          actualDate:       outcome.actualDate || undefined,
          actualAttendance: outcome.actualAttendance ? parseInt(outcome.actualAttendance) : undefined,
          feedbackScore:    outcome.feedbackScore ? parseFloat(outcome.feedbackScore) : undefined,
          keyObservations:  outcome.keyObservations || undefined,
          followUpRequired: outcome.followUpRequired,
          followUpNotes:    outcome.followUpNotes || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setWorkshop(data.workshop)
        setShowOutcome(false)
      } else {
        setError('Failed to save outcome.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
    </div>
  )
  if (!workshop) return (
    <div className="text-center py-16 text-slate-400">Workshop not found.</div>
  )

  const attendanceRate = workshop.plannedAttendance && workshop.actualAttendance
    ? Math.round((workshop.actualAttendance / workshop.plannedAttendance) * 100)
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/workshops" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 leading-tight">{workshop.title}</h1>
          <p className="text-slate-400 text-xs mt-0.5">{workshop.schoolId?.name}</p>
        </div>
        {canEdit && (
          <Link href={`/dashboard/workshops/${params.id}/edit`} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Edit3 size={14} /> Edit
          </Link>
        )}
      </div>

      {/* Status + Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', STATUS_COLORS[workshop.status] || 'bg-slate-100 text-slate-600')}>
              {workshop.status.charAt(0) + workshop.status.slice(1).toLowerCase()}
            </span>
            {workshop.priority === 'HIGH' && (
              <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full">
                <AlertTriangle size={11} /> High Priority
              </span>
            )}
          </div>

          {canEdit && NEXT_STATUSES[workshop.status]?.length > 0 && (
            <div className="flex gap-2">
              {NEXT_STATUSES[workshop.status].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    if (s === 'COMPLETED') setShowOutcome(true)
                    else updateStatus(s)
                  }}
                  disabled={saving}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors',
                    s === 'COMPLETED' ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' :
                    s === 'CONFIRMED' ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600' :
                    'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                  )}
                >
                  {s === 'COMPLETED' ? '✓ Mark Completed' :
                   s === 'CONFIRMED' ? 'Confirm' :
                   s === 'POSTPONED' ? 'Postpone' : 'Cancel'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2">Workshop Details</h3>
          <Detail label="Program Type" value={workshop.programType?.replace(/_/g, ' ')} />
          <Detail label="Theme" value={workshop.theme} />
          <Detail label="Target Group" value={workshop.targetGroup} />
          {workshop.gradeRange && <Detail label="Grade Range" value={workshop.gradeRange} />}
          <Detail label="Series Type" value={workshop.seriesType?.replace(/_/g, ' ')} />
          <Detail label="Duration" value={`${workshop.durationMinutes} minutes`} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2">Schedule & Logistics</h3>
          <Detail
            label="Planned Date"
            value={workshop.plannedDate
              ? new Date(workshop.plannedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
              : 'Not set'}
          />
          {workshop.actualDate && (
            <Detail
              label="Actual Date"
              value={new Date(workshop.actualDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              highlight
            />
          )}
          <Detail label="Mode" value={workshop.mode} />
          {workshop.month && <Detail label="Calendar Month" value={workshop.month} />}
          {workshop.conductedById && (
            <Detail label="Facilitated By" value={workshop.conductedById.name} />
          )}
          {workshop.materialPreparedBy && (
            <Detail label="Material By" value={workshop.materialPreparedBy} />
          )}
          <Detail label="Material Status" value={workshop.materialStatus?.replace(/_/g, ' ')} />
        </div>
      </div>

      {/* Attendance & Outcome */}
      {workshop.status === 'COMPLETED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-900 text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} /> Outcome Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-slate-900">{workshop.actualAttendance ?? '—'}</div>
              <div className="text-xs text-slate-500 mt-1">Attended</div>
              {attendanceRate && <div className="text-xs text-green-600 font-medium">{attendanceRate}% of planned</div>}
            </div>
            <div className="text-center bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{workshop.feedbackScore ? `${workshop.feedbackScore}/5` : '—'}</div>
              <div className="text-xs text-slate-500 mt-1">Feedback Score</div>
              {workshop.feedbackScore && (
                <div className="flex justify-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={10} className={n <= workshop.feedbackScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
                  ))}
                </div>
              )}
            </div>
            <div className="text-center bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-slate-900">
                {workshop.followUpRequired ? '⚑' : '✓'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {workshop.followUpRequired ? 'Follow-up needed' : 'No follow-up'}
              </div>
            </div>
          </div>
          {workshop.keyObservations && (
            <div className="mt-4 bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Key Observations</p>
              <p className="text-sm text-slate-700">{workshop.keyObservations}</p>
            </div>
          )}
          {workshop.followUpNotes && (
            <div className="mt-3 bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Follow-up Notes</p>
              <p className="text-sm text-slate-700">{workshop.followUpNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Record Outcome Form */}
      {showOutcome && canEdit && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Record Workshop Outcome</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={saveOutcome} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Actual Date</label>
                <input type="date" value={outcome.actualDate}
                  onChange={e => setOutcome(o => ({ ...o, actualDate: e.target.value }))}
                  className="input w-full" />
              </div>
              <div>
                <label className="label">Actual Attendance</label>
                <input type="number" min="0" value={outcome.actualAttendance}
                  onChange={e => setOutcome(o => ({ ...o, actualAttendance: e.target.value }))}
                  placeholder="e.g. 28" className="input w-full" />
              </div>
              <div>
                <label className="label">Feedback Score (1–5)</label>
                <select value={outcome.feedbackScore}
                  onChange={e => setOutcome(o => ({ ...o, feedbackScore: e.target.value }))}
                  className="input w-full">
                  <option value="">Not collected</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Key Observations</label>
              <textarea rows={3} value={outcome.keyObservations}
                onChange={e => setOutcome(o => ({ ...o, keyObservations: e.target.value }))}
                placeholder="What went well? What needs improvement? Student engagement level?"
                className="input w-full resize-none" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="followup" checked={outcome.followUpRequired}
                onChange={e => setOutcome(o => ({ ...o, followUpRequired: e.target.checked }))}
                className="rounded text-purple-600" />
              <label htmlFor="followup" className="text-sm text-slate-700">Follow-up required for some students</label>
            </div>
            {outcome.followUpRequired && (
              <div>
                <label className="label">Follow-up Notes</label>
                <textarea rows={2} value={outcome.followUpNotes}
                  onChange={e => setOutcome(o => ({ ...o, followUpNotes: e.target.value }))}
                  placeholder="Who needs follow-up? What action?"
                  className="input w-full resize-none" />
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowOutcome(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Outcome'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comments */}
      {workshop.comments && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm mb-2">Comments / Notes</h3>
          <p className="text-sm text-slate-600">{workshop.comments}</p>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, highlight = false }: { label: string; value?: string | number | null; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={cn('text-sm font-medium', highlight ? 'text-green-700' : 'text-slate-800')}>
        {value || '—'}
      </p>
    </div>
  )
}
