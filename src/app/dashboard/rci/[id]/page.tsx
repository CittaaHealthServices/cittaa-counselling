'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, ClipboardList, User, School, FileText,
  ChevronRight, Calendar, CheckCircle2, ExternalLink,
  Save, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  NOTIFIED:         'bg-yellow-100 text-yellow-700',
  VISIT_SCHEDULED:  'bg-purple-100 text-purple-700',
  VISITING:         'bg-indigo-100 text-indigo-700',
  REPORT_SUBMITTED: 'bg-green-100 text-green-700',
  CLOSED:           'bg-slate-100 text-slate-700',
}

const STATUS_STEPS = [
  { key: 'NOTIFIED',         label: 'Notified' },
  { key: 'VISIT_SCHEDULED',  label: 'Visit Scheduled' },
  { key: 'VISITING',         label: 'Visiting' },
  { key: 'REPORT_SUBMITTED', label: 'Report Submitted' },
  { key: 'CLOSED',           label: 'Closed' },
]

export default function RCIDetailPage() {
  const { id }            = useParams<{ id: string }>()
  const router            = useRouter()
  const { data: session } = useSession()
  const role              = session?.user?.role || ''

  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Editable fields
  const [status, setStatus]           = useState('')
  const [visitDate, setVisitDate]     = useState('')
  const [findings, setFindings]       = useState('')
  const [recommendations, setRec]     = useState('')
  const [reportUrl, setReportUrl]     = useState('')
  const [internalNotes, setNotes]     = useState('')

  const isRCI      = role === 'RCI_TEAM'
  const isAdmin    = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const canEdit    = isRCI || isAdmin

  useEffect(() => {
    fetch(`/api/rci/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const r = d.rciReport
        if (!r) return
        setData(r)
        setStatus(r.status || 'NOTIFIED')
        setVisitDate(r.visitDate ? r.visitDate.split('T')[0] : '')
        setFindings(r.findings || '')
        setRec(r.recommendations || '')
        setReportUrl(r.reportUrl || '')
        setNotes(r.internalNotes || '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { status, findings, recommendations, reportUrl, internalNotes }
      if (visitDate) body.visitDate = visitDate
      const res    = await fetch(`/api/rci/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('RCI report updated')
        setData(result.rciReport)
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
        RCI report not found.{' '}
        <Link href="/dashboard/rci" className="text-purple-600 hover:underline">Back</Link>
      </div>
    )
  }

  const student    = data.studentId      || {}
  const assessment = data.assessmentId   || {}
  const school     = data.schoolId       || {}
  const assignedBy = data.assignedById   || {}

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === data.status)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">RCI Report</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
            <Link href="/dashboard/rci" className="hover:text-purple-600">RCI Reports</Link>
            <ChevronRight size={14} />
            <span className="font-mono">{data.reportNumber || id}</span>
          </div>
        </div>
        <span className={cn('badge', STATUS_COLORS[data.status] || 'bg-slate-100 text-slate-600')}>
          {data.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Progress stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((step, idx) => (
            <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                idx < currentStepIdx
                  ? 'bg-green-500 border-green-500 text-white'
                  : idx === currentStepIdx
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-slate-300 text-slate-400'
              )}>
                {idx < currentStepIdx ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span className={cn(
                'text-xs text-center leading-tight',
                idx <= currentStepIdx ? 'text-slate-700 font-medium' : 'text-slate-400'
              )}>
                {step.label}
              </span>
              {idx < STATUS_STEPS.length - 1 && (
                <div className={cn(
                  'absolute h-0.5 w-full top-4',
                  idx < currentStepIdx ? 'bg-green-400' : 'bg-slate-200'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Assessment link */}
          {assessment._id && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <ClipboardList size={16} className="text-indigo-600" /> Linked Assessment
              </h2>
              <Link href={`/dashboard/assessments/${assessment._id}`}
                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                <FileText size={14} />
                {assessment.requestNumber || 'View Assessment'}
                <ChevronRight size={13} />
              </Link>
              {assessment.assessmentType && (
                <div className="mt-2 text-xs text-slate-500">
                  Type: <span className="font-medium text-slate-700">{assessment.assessmentType.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Admin note (read-only) */}
          {data.adminNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
                <AlertTriangle size={14} /> Notes from Cittaa Admin
              </div>
              <div className="text-amber-800 text-sm">{data.adminNote}</div>
            </div>
          )}

          {/* Visit scheduling + report fields */}
          {canEdit ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Calendar size={16} className="text-purple-600" /> Visit & Report Details
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Update Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select">
                    {STATUS_STEPS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Visit Date</label>
                  <input type="date" value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Findings</label>
                <textarea value={findings} onChange={(e) => setFindings(e.target.value)}
                  rows={4}
                  placeholder="Document assessment findings from the school visit..."
                  className="form-textarea w-full"
                />
              </div>

              <div>
                <label className="form-label">Recommendations</label>
                <textarea value={recommendations} onChange={(e) => setRec(e.target.value)}
                  rows={4}
                  placeholder="Recommended interventions, support, or next steps..."
                  className="form-textarea w-full"
                />
              </div>

              <div>
                <label className="form-label">Report URL / Document Link (optional)</label>
                <input type="url" value={reportUrl}
                  onChange={(e) => setReportUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="form-input"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="form-label">Internal Notes (admin only)</label>
                  <textarea value={internalNotes} onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="form-textarea w-full"
                    placeholder="Internal notes not visible to school..."
                  />
                </div>
              )}

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
            </div>
          ) : (
            /* Read-only view */
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-purple-600" /> Report Details
              </h2>
              {data.visitDate && (
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-1">Visit Date</div>
                  <div className="text-slate-800 text-sm font-medium">{formatDate(data.visitDate)}</div>
                </div>
              )}
              {data.findings && (
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-1">Findings</div>
                  <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{data.findings}</div>
                </div>
              )}
              {data.recommendations && (
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-1">Recommendations</div>
                  <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{data.recommendations}</div>
                </div>
              )}
              {data.reportUrl && (
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-1">Report Document</div>
                  <a href={data.reportUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 text-sm font-medium">
                    View Report <ExternalLink size={13} />
                  </a>
                </div>
              )}
              {!data.findings && !data.recommendations && !data.reportUrl && (
                <p className="text-slate-400 italic text-sm">No report details submitted yet.</p>
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
              {student.age && <div className="text-slate-400 text-xs">Age: {student.age}</div>}
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

          {/* Assigned by */}
          {assignedBy.name && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <User size={15} className="text-purple-600" />
                </div>
                <div className="text-sm font-semibold text-slate-700">Assigned By</div>
              </div>
              <div className="text-sm">
                <div className="font-medium text-slate-900">{assignedBy.name}</div>
                <div className="text-slate-500 text-xs">{assignedBy.email}</div>
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
                <span>Created</span>
                <span className="text-slate-700">{formatDate(data.createdAt)}</span>
              </div>
              {data.visitDate && (
                <div className="flex justify-between">
                  <span>Visit Date</span>
                  <span className="text-purple-600">{formatDate(data.visitDate)}</span>
                </div>
              )}
              {data.submittedAt && (
                <div className="flex justify-between">
                  <span>Submitted</span>
                  <span className="text-green-600">{formatDate(data.submittedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
