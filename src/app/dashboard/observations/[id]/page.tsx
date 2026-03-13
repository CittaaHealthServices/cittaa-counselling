'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Eye, User, School, FileText,
  ChevronRight, Calendar, Tag, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'

const BEHAVIOUR_LABELS: Record<string, string> = {
  ACADEMIC:      'Academic',
  SOCIAL:        'Social',
  EMOTIONAL:     'Emotional',
  BEHAVIOURAL:   'Behavioural',
  PHYSICAL:      'Physical',
  ATTENDANCE:    'Attendance',
  OTHER:         'Other',
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW:      'bg-green-100 text-green-700',
  MODERATE: 'bg-yellow-100 text-yellow-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export default function ObservationDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const role               = session?.user?.role || ''

  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Editable
  const [notes, setNotes]           = useState('')
  const [followUp, setFollowUp]     = useState('')
  const [actionTaken, setAction]    = useState('')

  const isPsychologist = role === 'PSYCHOLOGIST'
  const isAdmin        = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const isTeacher      = ['CLASS_TEACHER', 'COORDINATOR'].includes(role)
  const isPrincipal    = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)

  // Psychologists and admins can add follow-up notes; original author can edit
  const canAddFollowUp = isPsychologist || isAdmin
  const canViewDetails = isPsychologist || isAdmin || isTeacher || isPrincipal

  useEffect(() => {
    fetch(`/api/observations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const obs = d.observation
        if (!obs) return
        setData(obs)
        setNotes(obs.psychologistNotes || '')
        setFollowUp(obs.followUpPlan || '')
        setAction(obs.actionTaken || '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const res    = await fetch(`/api/observations/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          psychologistNotes: notes,
          followUpPlan:      followUp,
          actionTaken:       actionTaken,
        }),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('Observation updated')
        setData(result.observation)
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
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        Observation not found.{' '}
        <Link href="/dashboard/observations" className="text-purple-600 hover:underline">Back</Link>
      </div>
    )
  }

  const student    = data.studentId    || {}
  const observer   = data.observedById || data.createdById || {}
  const school     = data.schoolId     || {}
  const request    = data.requestId    || {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Observation Detail</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
            <Link href="/dashboard/observations" className="hover:text-purple-600">Observations</Link>
            <ChevronRight size={14} />
            <span>{formatDate(data.observationDate || data.createdAt)}</span>
          </div>
        </div>
        {data.severity && (
          <span className={cn('badge', SEVERITY_COLORS[data.severity] || 'bg-slate-100 text-slate-600')}>
            {data.severity}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Observation content */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Eye size={16} className="text-purple-600" /> Observation
            </h2>

            {/* Category tags */}
            {data.categories?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.categories.map((cat: string) => (
                  <span key={cat}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                    <Tag size={10} />
                    {BEHAVIOUR_LABELS[cat] || cat}
                  </span>
                ))}
              </div>
            )}

            {/* Main observation text */}
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Description</div>
              <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                {data.description || data.observationText || '—'}
              </p>
            </div>

            {/* Context */}
            {data.context && (
              <div>
                <div className="text-slate-400 text-xs font-medium mb-1">Context / Setting</div>
                <p className="text-slate-700 text-sm">{data.context}</p>
              </div>
            )}

            {/* Linked request */}
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
          </div>

          {/* Teacher's original note (if submitted by teacher) */}
          {data.teacherNote && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <div className="text-slate-500 text-xs font-medium mb-2">Teacher's Note</div>
              <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{data.teacherNote}</p>
            </div>
          )}

          {/* Psychologist / follow-up section */}
          {canAddFollowUp && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" /> Psychologist Notes & Follow-up
              </h2>

              <div>
                <label className="form-label">Psychologist Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Professional assessment, interpretations, clinical observations..."
                  className="form-textarea w-full"
                />
              </div>

              <div>
                <label className="form-label">Action Taken</label>
                <textarea value={actionTaken} onChange={(e) => setAction(e.target.value)}
                  rows={3}
                  placeholder="Steps taken or interventions implemented so far..."
                  className="form-textarea w-full"
                />
              </div>

              <div>
                <label className="form-label">Follow-up Plan</label>
                <textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                  rows={3}
                  placeholder="Planned interventions, referrals, or next steps..."
                  className="form-textarea w-full"
                />
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
                  <><Save size={15} /> Save Notes</>
                )}
              </button>
            </div>
          )}

          {/* Read-only psychologist notes (for non-psychologist roles) */}
          {!canAddFollowUp && (data.psychologistNotes || data.actionTaken || data.followUpPlan) && (
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 space-y-3">
              <h2 className="font-semibold text-indigo-800 text-sm">Psychologist Notes</h2>
              {data.psychologistNotes && (
                <div>
                  <div className="text-indigo-600 text-xs font-medium mb-1">Notes</div>
                  <p className="text-indigo-900 text-sm whitespace-pre-wrap">{data.psychologistNotes}</p>
                </div>
              )}
              {data.actionTaken && (
                <div>
                  <div className="text-indigo-600 text-xs font-medium mb-1">Action Taken</div>
                  <p className="text-indigo-900 text-sm">{data.actionTaken}</p>
                </div>
              )}
              {data.followUpPlan && (
                <div>
                  <div className="text-indigo-600 text-xs font-medium mb-1">Follow-up Plan</div>
                  <p className="text-indigo-900 text-sm">{data.followUpPlan}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Student */}
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
              {student.rollNumber && (
                <div className="text-slate-400 text-xs">Roll: {student.rollNumber}</div>
              )}
            </div>
          </div>

          {/* Observer */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <User size={15} className="text-purple-600" />
              </div>
              <div className="text-sm font-semibold text-slate-700">Observed By</div>
            </div>
            <div className="text-sm space-y-1">
              <div className="font-medium text-slate-900">{observer.name || '—'}</div>
              <div className="text-slate-500 text-xs capitalize">{observer.role?.replace(/_/g, ' ') || ''}</div>
              <div className="text-slate-400 text-xs">{observer.email}</div>
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
                {school.city && <div className="text-slate-500">{school.city}</div>}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" /> Timeline
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Observed</span>
                <span className="text-slate-700">{formatDate(data.observationDate || data.createdAt)}</span>
              </div>
              {data.updatedAt && data.updatedAt !== data.createdAt && (
                <div className="flex justify-between">
                  <span>Last Updated</span>
                  <span className="text-slate-700">{formatDate(data.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
