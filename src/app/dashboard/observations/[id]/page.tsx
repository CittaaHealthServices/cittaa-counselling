'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle,
  ArrowUpCircle, Clock, RefreshCw, FileText, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Obs = {
  _id: string
  studentId: { _id: string; name: string; class?: string; section?: string; rollNumber?: string; gender?: string } | null
  conductedById: { _id: string; name: string; email: string } | null
  classObserved: string; visitDate: string
  behaviourFlags: string[]; observationNotes: string; recommendations: string
  sharedWith: { _id: string; name: string; email: string; role: string }[]
  sharedWithEmails: string[]
  recommendEscalation: boolean; status: string
  teacherResponse: string; declineReason: string
  escalatedRequestId?: { _id: string; requestNumber: string; status: string } | null
  createdAt: string; updatedAt: string
}

const S: Record<string, { label: string; cls: string; Icon: any }> = {
  DRAFT:           { label: 'Draft',               cls: 'bg-slate-100 text-slate-600',   Icon: Clock },
  AWAITING_REVIEW: { label: 'Awaiting Review',     cls: 'bg-yellow-100 text-yellow-700', Icon: AlertTriangle },
  ACKNOWLEDGED:    { label: 'Acknowledged',        cls: 'bg-green-100 text-green-700',   Icon: CheckCircle2 },
  ESCALATED:       { label: 'Escalated → Request', cls: 'bg-purple-100 text-purple-700', Icon: ArrowUpCircle },
  DECLINED:        { label: 'Declined',            cls: 'bg-red-100 text-red-700',       Icon: XCircle },
}

function Row({ label, value }: { label: string; value?: string|null }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 font-medium">{value || '—'}</p>
    </div>
  )
}

export default function ObsDetail({ params }: { params: { id: string } }) {
  const router            = useRouter()
  const { data: session } = useSession()
  const [obs, setObs]     = useState<Obs|null>(null)
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [actLoad, setActLoad]   = useState<string|null>(null)
  const [note, setNote]         = useState('')
  const [decReason, setDecReason] = useState('')
  const [showDec, setShowDec]   = useState(false)

  const role   = session?.user?.role ?? ''
  const userId = session?.user?.id   ?? ''

  useEffect(() => {
    fetch(`/api/observations/${params.id}?_t=${Date.now()}`)
      .then(r => r.json())
      .then(d => { if (d.observation) setObs(d.observation); else setErr('Not found') })
      .catch(() => setErr('Could not load'))
      .finally(() => setLoading(false))
  }, [params.id])

  const act = async (action: string, extra?: object) => {
    if (actLoad) return
    setActLoad(action); setErr('')
    try {
      const res  = await fetch(`/api/observations/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      setObs(data.observation)
    } catch (e: any) { setErr(e.message) }
    finally { setActLoad(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400"><RefreshCw size={18} className="animate-spin mr-2"/>Loading…</div>
  if (!obs)    return <div className="p-6 text-center text-red-600">{err || 'Observation not found'}</div>

  const cfg    = S[obs.status] ?? S.DRAFT
  const CfgIcon = cfg.Icon
  const stu    = obs.studentId
  const psych  = obs.conductedById

  const isPsych    = ['PSYCHOLOGIST','CITTAA_ADMIN','CITTAA_SUPPORT'].includes(role)
  const isReviewer = ['SCHOOL_PRINCIPAL','SCHOOL_ADMIN','CLASS_TEACHER','COORDINATOR'].includes(role)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 transition">
          <ArrowLeft size={16}/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Classroom Observation</h1>
          <p className="text-slate-500 text-sm">{psych?.name ?? '—'} · {obs.visitDate ? new Date(obs.visitDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold', cfg.cls)}>
          <CfgIcon size={13}/> {cfg.label}
        </span>
      </div>

      {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{err}</div>}

      {obs.status === 'ESCALATED' && obs.escalatedRequestId && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 flex items-start gap-3">
          <ArrowUpCircle size={18} className="text-purple-600 mt-0.5 shrink-0"/>
          <div>
            <p className="text-purple-800 font-semibold text-sm">Escalated to Counselling Request</p>
            <p className="text-purple-600 text-sm mt-0.5">
              Request{' '}
              <Link href={`/dashboard/requests/${obs.escalatedRequestId._id}`} className="font-bold underline">
                {obs.escalatedRequestId.requestNumber}
              </Link>{' '}
              created successfully.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Student */}
          <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Student</h2>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Name"     value={stu?.name} />
              <Row label="Roll No." value={stu?.rollNumber} />
              <Row label="Class"    value={[stu?.class, stu?.section].filter(Boolean).join(' ') || null} />
              <Row label="Gender"   value={stu?.gender} />
            </div>
          </div>

          {/* Visit */}
          <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Visit Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Class Observed" value={obs.classObserved} />
              <Row label="Visit Date"     value={obs.visitDate ? new Date(obs.visitDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : null} />
              <Row label="Conducted By"   value={psych?.name} />
              <Row label="Escalation Rec." value={obs.recommendEscalation ? 'Yes' : 'No'} />
            </div>
          </div>

          {/* Flags */}
          <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Behaviour Flags</h2>
            {obs.behaviourFlags?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {obs.behaviourFlags.map(f => (
                  <span key={f} className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full border border-orange-200">
                    <AlertTriangle size={11}/> {f}
                  </span>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm">No flags recorded</p>}
          </div>

          {/* Observation Notes */}
          <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><FileText size={14} className="text-blue-500"/> Observation Notes</h2>
            {obs.observationNotes
              ? <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{obs.observationNotes}</p>
              : <p className="text-slate-400 text-sm italic">No notes recorded</p>}
          </div>

          {/* Recommendations */}
          {obs.recommendations && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-2">
              <h2 className="font-semibold text-blue-800 text-sm flex items-center gap-2"><MessageSquare size={14}/> Psychologist's Recommendations</h2>
              <p className="text-blue-700 text-sm leading-relaxed whitespace-pre-wrap">{obs.recommendations}</p>
            </div>
          )}

          {/* Teacher response */}
          {obs.teacherResponse && (
            <div className="rounded-2xl border border-green-100 bg-green-50 p-5 space-y-2">
              <h2 className="font-semibold text-green-800 text-sm">Teacher / Coordinator Response</h2>
              <p className="text-green-700 text-sm whitespace-pre-wrap">{obs.teacherResponse}</p>
            </div>
          )}

          {/* Decline reason */}
          {obs.declineReason && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 space-y-2">
              <h2 className="font-semibold text-red-800 text-sm">Decline Reason</h2>
              <p className="text-red-700 text-sm whitespace-pre-wrap">{obs.declineReason}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Shared with */}
          <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Shared With</h2>
            {obs.sharedWith?.length > 0 ? (
              obs.sharedWith.map(u => (
                <div key={u._id} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold">
                    {u.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.role}</p>
                  </div>
                </div>
              ))
            ) : obs.sharedWithEmails?.length > 0 ? (
              obs.sharedWithEmails.map(e => <p key={e} className="text-sm text-slate-600">{e}</p>)
            ) : (
              <p className="text-slate-400 text-sm">Not shared yet</p>
            )}
          </div>

          {/* Action panel */}
          <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Actions</h2>

            {/* Psychologist: recommend */}
            {isPsych && obs.status === 'DRAFT' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Send observation to teacher/coordinator for review:</p>
                <button onClick={() => act('recommend')} disabled={!!actLoad}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-60">
                  {actLoad === 'recommend' ? <RefreshCw size={13} className="animate-spin"/> : <AlertTriangle size={13}/>}
                  {actLoad === 'recommend' ? 'Sending…' : '⚠ Recommend Escalation'}
                </button>
              </div>
            )}

            {/* Reviewer: escalate / acknowledge / decline */}
            {isReviewer && obs.status === 'AWAITING_REVIEW' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Psychologist recommends a counselling session:</p>
                <textarea rows={3} placeholder="Add a response note (optional)…" value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"/>

                <button onClick={() => act('escalate', { teacherResponse: note })} disabled={!!actLoad}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition disabled:opacity-60">
                  {actLoad === 'escalate' ? <RefreshCw size={13} className="animate-spin"/> : <ArrowUpCircle size={13}/>}
                  {actLoad === 'escalate' ? 'Creating Request…' : 'Escalate → Create Request'}
                </button>

                <button onClick={() => act('acknowledge', { teacherResponse: note })} disabled={!!actLoad}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-60">
                  {actLoad === 'acknowledge' ? <RefreshCw size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
                  {actLoad === 'acknowledge' ? 'Saving…' : 'Acknowledge — No Action Needed'}
                </button>

                {!showDec ? (
                  <button onClick={() => setShowDec(true)}
                    className="w-full px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition">
                    Decline
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea rows={2} placeholder="Reason for declining…" value={decReason}
                      onChange={e => setDecReason(e.target.value)}
                      className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"/>
                    <div className="flex gap-2">
                      <button onClick={() => act('decline', { declineReason: decReason, teacherResponse: note })}
                        disabled={!!actLoad || !decReason.trim()}
                        className="flex-1 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition">
                        {actLoad === 'decline' ? 'Declining…' : 'Confirm Decline'}
                      </button>
                      <button onClick={() => setShowDec(false)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {['ACKNOWLEDGED','ESCALATED','DECLINED'].includes(obs.status) && (
              <p className="text-xs text-slate-400 text-center py-1">No further actions available</p>
            )}
          </div>

          {/* Meta */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-1.5 text-xs text-slate-500">
            <p><span className="font-medium">Created:</span> {new Date(obs.createdAt).toLocaleString('en-IN')}</p>
            <p><span className="font-medium">Updated:</span> {new Date(obs.updatedAt).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
