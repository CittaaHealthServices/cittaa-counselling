'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Plus, Eye, CheckCircle2, XCircle, ArrowUpCircle,
  BarChart2, User2, AlertTriangle, Clock, ChevronDown,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Status display helpers ───────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  DRAFT:        'bg-slate-100 text-slate-600',
  SHARED:       'bg-yellow-100 text-yellow-700',
  ACKNOWLEDGED: 'bg-slate-100 text-slate-700',
  ESCALATED:    'bg-green-100 text-green-700',
  DECLINED:     'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT:        'Draft',
  SHARED:       'Awaiting Review',
  ACKNOWLEDGED: 'Acknowledged',
  ESCALATED:    'Escalated → Request',
  DECLINED:     'Declined',
}

const BEHAVIOUR_FLAGS = [
  'Withdrawn', 'Aggressive', 'Inattentive', 'Hyperactive', 'Tearful',
  'Disruptive', 'Isolating from peers', 'Frequent absences', 'Sleep-deprived',
  'Difficulty concentrating', 'Anxious', 'Self-harm concern',
]

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('rounded-xl p-4 border', color)}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ObservationsPage() {
  const { data: session } = useSession()
  const role = session?.user?.role || ''

  const isPrincipalView = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const canCreate       = role === 'PSYCHOLOGIST'
  const canReview       = ['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)

  const [observations, setObservations] = useState<any[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatus]       = useState('ALL')
  const [classFilter, setClassFilter]   = useState('')
  const [page, setPage]                 = useState(1)

  // Stats (principal only)
  const [stats, setStats]               = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Modals
  const [showNew, setShowNew]               = useState(false)
  const [reviewing, setReviewing]           = useState<any>(null)
  const [reviewNote, setReviewNote]         = useState('')
  const [escalatePriority, setEscPri]       = useState('MEDIUM')
  const [actionLoading, setActLoading]      = useState(false)

  // ── New observation form state ────────────────────────────────────────────
  const [schools, setSchools]               = useState<any[]>([])
  const [selectedSchoolId, setSelSchoolId]  = useState('')
  const [students, setStudents]             = useState<any[]>([])
  const [teachers, setTeachers]             = useState<any[]>([])
  const [studentSearch, setStSearch]        = useState('')
  const [selectedStudent, setSelStudent]    = useState<any>(null)
  const [filterClass, setFilterClass]       = useState('')
  const [filterSection, setFilterSection]   = useState('')
  const [useManual, setUseManual]           = useState(false)
  const [newObs, setNewObs] = useState({
    studentId:          '',
    manualStudentName:  '',
    manualStudentClass: '',
    manualStudentSection: '',
    classVisitDate:     new Date().toISOString().split('T')[0],
    classObserved:      '',
    observations:       '',
    behaviourFlags:     [] as string[],
    recommendEscalation: false,
    sharedWithId:       '',
  })

  // ── Fetch observations ────────────────────────────────────────────────────
  const fetchObs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (classFilter) params.set('class', classFilter)
    const res  = await fetch(`/api/observations?${params}`)
    const data = await res.json()
    setObservations(data.observations || [])
    setTotal(data.pagination?.total || 0)
    setLoading(false)
  }, [page, statusFilter, classFilter])

  useEffect(() => { fetchObs() }, [fetchObs])

  // ── Fetch stats (principal/admin) ─────────────────────────────────────────
  useEffect(() => {
    if (!isPrincipalView) return
    setStatsLoading(true)
    fetch('/api/observations?stats=true')
      .then((r) => r.json())
      .then((d) => setStats(d.stats || null))
      .finally(() => setStatsLoading(false))
  }, [isPrincipalView, observations]) // refresh when list changes

  // ── Load schools list for psychologist (to pick a school first) ───────────
  useEffect(() => {
    if (!showNew || !canCreate) return
    fetch('/api/schools')
      .then((r) => r.json())
      .then((d) => setSchools(d.schools || []))
  }, [showNew, canCreate])

  // ── Load students when modal opens (pass schoolId for psychologists) ──────
  useEffect(() => {
    if (!showNew) return
    const params = new URLSearchParams({ limit: '200' })
    // Psychologists must select a school first
    if (canCreate && !selectedSchoolId) { setStudents([]); return }
    if (canCreate && selectedSchoolId) params.set('schoolId', selectedSchoolId)
    if (filterClass)   params.set('class', filterClass)
    if (filterSection) params.set('section', filterSection)
    if (studentSearch) params.set('search', studentSearch)
    fetch(`/api/students?${params}`).then((r) => r.json()).then((d) => setStudents(d.students || []))
  }, [showNew, selectedSchoolId, filterClass, filterSection, studentSearch, canCreate])

  // ── Load teachers when modal opens (pass schoolId for psychologists) ──────
  useEffect(() => {
    if (!showNew) return
    const schoolParam = selectedSchoolId ? `&schoolId=${selectedSchoolId}` : ''
    Promise.all([
      fetch(`/api/users?role=CLASS_TEACHER${schoolParam}`).then((r) => r.json()),
      fetch(`/api/users?role=COORDINATOR${schoolParam}`).then((r) => r.json()),
    ]).then(([t, c]) => setTeachers([...(t.users || []), ...(c.users || [])]))
  }, [showNew, selectedSchoolId])

  // ── Auto-fill classObserved when student selected ─────────────────────────
  useEffect(() => {
    if (selectedStudent && !newObs.classObserved) {
      setNewObs((prev) => ({
        ...prev,
        classObserved: `Class ${selectedStudent.class}${selectedStudent.section ? ` ${selectedStudent.section}` : ''}`,
      }))
    }
  }, [selectedStudent]) // eslint-disable-line

  // ── Submit new observation ────────────────────────────────────────────────
  async function handleSubmitObs() {
    const hasStudent = newObs.studentId || (useManual && newObs.manualStudentName && newObs.manualStudentClass)
    if (!hasStudent || !newObs.classObserved || !newObs.observations) {
      toast.error('Please fill in all required fields'); return
    }
    setActLoading(true)
    try {
      const body: any = {
        classVisitDate:      newObs.classVisitDate,
        classObserved:       newObs.classObserved,
        observations:        newObs.observations,
        behaviourFlags:      newObs.behaviourFlags,
        recommendEscalation: newObs.recommendEscalation,
        sharedWithId:        newObs.sharedWithId || undefined,
      }
      if (useManual) {
        body.manualStudentName    = newObs.manualStudentName
        body.manualStudentClass   = newObs.manualStudentClass
        body.manualStudentSection = newObs.manualStudentSection || undefined
      } else {
        body.studentId = newObs.studentId
      }

      const res  = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(newObs.sharedWithId ? 'Observation shared with teacher' : 'Observation saved as draft')
        setShowNew(false)
        resetForm()
        fetchObs()
      } else { toast.error(data.error || 'Failed to save') }
    } finally { setActLoading(false) }
  }

  function resetForm() {
    setNewObs({
      studentId: '', manualStudentName: '', manualStudentClass: '', manualStudentSection: '',
      classVisitDate: new Date().toISOString().split('T')[0],
      classObserved: '', observations: '',
      behaviourFlags: [], recommendEscalation: false, sharedWithId: '',
    })
    setSelStudent(null); setStSearch(''); setFilterClass(''); setFilterSection(''); setUseManual(false); setSelSchoolId('')
  }

  // ── Teacher review actions ────────────────────────────────────────────────
  async function handleAction(obsId: string, action: 'acknowledge' | 'escalate' | 'decline') {
    setActLoading(true)
    try {
      const res  = await fetch(`/api/observations/${obsId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote, priority: escalatePriority }),
      })
      const data = await res.json()
      if (res.ok) {
        const msgs: Record<string, string> = {
          acknowledge: 'Observation acknowledged',
          escalate:    `Counselling request ${data.counsellingRequest?.requestNumber || ''} created!`,
          decline:     'Observation declined',
        }
        toast.success(msgs[action])
        setReviewing(null); setReviewNote('')
        fetchObs()
      } else { toast.error(data.error || 'Failed') }
    } finally { setActLoading(false) }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Classroom Observations</h1>
          <p className="page-subtitle">
            {role === 'PSYCHOLOGIST'    && 'Record classroom visit notes and share with the respective teacher or coordinator'}
            {role === 'CLASS_TEACHER'   && 'Review observation notes shared by the school psychologist for your students'}
            {role === 'COORDINATOR'     && 'Review and action observation notes shared with you by the psychologist'}
            {isPrincipalView            && 'School-wide overview of all classroom observations conducted by psychologists'}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={16} /> New Observation
          </button>
        )}
      </div>

      {/* ── Principal Stats Panel ──────────────────────────────────────────── */}
      {isPrincipalView && (
        <div className="space-y-4">
          {statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : stats ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <StatCard label="Total Observations"  value={stats.total}        color="bg-slate-50 border-slate-200 text-slate-700" />
                <StatCard label="Awaiting Review"     value={stats.shared}       color="bg-yellow-50 border-yellow-200 text-yellow-800" />
                <StatCard label="Escalated → Request" value={stats.escalated}    color="bg-green-50 border-green-200 text-green-800" />
                <StatCard label="Acknowledged"        value={stats.acknowledged} color="bg-purple-50 border-purple-200 text-purple-800" />
                <StatCard label="Declined"            value={stats.declined}     color="bg-red-50 border-red-200 text-red-800" />
                <StatCard label="Drafts"              value={stats.draft}        color="bg-slate-50 border-slate-200 text-slate-500" />
              </div>

              {/* Per-psychologist breakdown */}
              {stats.perPsychologist?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
                    <BarChart2 size={16} className="text-purple-600" />
                    <span className="font-semibold text-sm text-slate-900">Observations by Psychologist</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Psychologist</th>
                          <th className="text-center">Total Shared</th>
                          <th className="text-center">Awaiting</th>
                          <th className="text-center">Escalated</th>
                          <th className="text-center">Acknowledged</th>
                          <th className="text-center">Declined</th>
                          <th>Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.perPsychologist.map((p: any) => (
                          <tr key={p._id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                                  {(p.psychologistName || '?')[0]}
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-slate-900">{p.psychologistName || 'Unknown'}</div>
                                  <div className="text-xs text-slate-400">{p.psychologistEmail}</div>
                                </div>
                              </div>
                            </td>
                            <td className="text-center font-semibold text-slate-800">{p.total}</td>
                            <td className="text-center">
                              {p.pending > 0
                                ? <span className="badge bg-yellow-100 text-yellow-700">{p.pending}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="text-center">
                              {p.escalated > 0
                                ? <span className="badge bg-green-100 text-green-700">{p.escalated}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="text-center text-slate-500">{p.acknowledged || '—'}</td>
                            <td className="text-center text-slate-400 text-sm">{p.declined || '—'}</td>
                            <td className="text-xs text-slate-400">
                              {p.lastActivity ? formatDate(p.lastActivity) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'DRAFT', 'SHARED', 'ACKNOWLEDGED', 'ESCALATED', 'DECLINED'].map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Class filter (for principal/admin) */}
        {isPrincipalView && (
          <input
            type="text"
            placeholder="Filter by class (e.g. 8)"
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setPage(1) }}
            className="form-input w-40 text-xs"
          />
        )}
      </div>

      {/* ── Observations Table ────────────────────────────────────────────── */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : observations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
            <Eye size={28} className="mb-2 opacity-40" />
            No observations found
            {canCreate && (
              <button onClick={() => setShowNew(true)} className="mt-3 text-purple-600 hover:text-purple-800">
                Record your first observation →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class Observed</th>
                  <th>Behaviour Flags</th>
                  {(role !== 'PSYCHOLOGIST') && <th>Psychologist</th>}
                  <th>Shared With</th>
                  <th>Visit Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {observations.map((obs) => {
                  const student   = obs.studentId
                  const psych     = obs.psychologistId
                  const teacher   = obs.sharedWithId
                  const isPending = obs.status === 'SHARED' && canReview

                  return (
                    <tr key={obs._id} className={isPending && obs.sharedWithId?._id === session?.user?.id ? 'bg-yellow-50/40' : ''}>
                      <td>
                        <div className="font-medium text-slate-900">{student?.name}</div>
                        <div className="text-xs text-slate-400">
                          Class {student?.class}{student?.section ? ` – ${student.section}` : ''}
                        </div>
                      </td>
                      <td className="text-slate-600 text-sm">{obs.classObserved}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(obs.behaviourFlags || []).slice(0, 2).map((f: string) => (
                            <span key={f} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{f}</span>
                          ))}
                          {obs.behaviourFlags?.length > 2 && (
                            <span className="text-xs text-slate-400">+{obs.behaviourFlags.length - 2}</span>
                          )}
                          {obs.recommendEscalation && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                              ⚠ Recommend
                            </span>
                          )}
                        </div>
                      </td>
                      {role !== 'PSYCHOLOGIST' && (
                        <td className="text-slate-500 text-sm">{psych?.name || '—'}</td>
                      )}
                      <td className="text-slate-500 text-sm">{teacher?.name || '—'}</td>
                      <td className="text-slate-400 text-xs">{formatDate(obs.classVisitDate)}</td>
                      <td>
                        <span className={cn('badge', STATUS_STYLES[obs.status] || 'bg-gray-100 text-gray-600')}>
                          {STATUS_LABELS[obs.status] || obs.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2 items-center">
                          <Link href={`/dashboard/observations/${obs._id}`}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                            View
                          </Link>
                          {isPending && obs.sharedWithId?._id === session?.user?.id && (
                            <button
                              onClick={() => { setReviewing(obs); setReviewNote('') }}
                              className="text-xs text-yellow-600 hover:text-yellow-800 font-medium">
                              Review →
                            </button>
                          )}
                          {/* Principal can also trigger review on any pending observation */}
                          {isPrincipalView && obs.status === 'SHARED' && (
                            <button
                              onClick={() => { setReviewing(obs); setReviewNote('') }}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium">
                              Action →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 rounded text-xs border border-slate-200 disabled:opacity-40">← Prev</button>
                  <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 rounded text-xs border border-slate-200 disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New Observation Modal ─────────────────────────────────────────── */}
      {showNew && (
        <Modal title="New Classroom Observation" onClose={() => { setShowNew(false); resetForm() }}>
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">

            {/* School selector — shown only for psychologists (they have no fixed school) */}
            {canCreate && schools.length > 0 && (
              <div>
                <label className="form-label">School <span className="text-red-500">*</span></label>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => { setSelSchoolId(e.target.value); setSelStudent(null); setStSearch(''); setStudents([]); setTeachers([]) }}
                  className="form-select"
                >
                  <option value="">— Select school —</option>
                  {schools.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
                {!selectedSchoolId && (
                  <p className="text-xs text-amber-600 mt-1">Select a school first to search students and teachers</p>
                )}
              </div>
            )}

            {/* Toggle: Select from system vs manual entry */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              <button
                onClick={() => { setUseManual(false); setNewObs(p => ({ ...p, manualStudentName: '', manualStudentClass: '', manualStudentSection: '' })) }}
                className={cn('flex-1 py-2 font-medium transition-colors',
                  !useManual ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                Search Student
              </button>
              <button
                onClick={() => { setUseManual(true); setSelStudent(null); setNewObs(p => ({ ...p, studentId: '' })) }}
                className={cn('flex-1 py-2 font-medium transition-colors',
                  useManual ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                Enter Manually
              </button>
            </div>

            {/* Student Selector */}
            {!useManual ? (
              <div>
                <label className="form-label">Student <span className="text-red-500">*</span></label>
                {/* Class + Section pre-filters */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input type="text" placeholder="Class (e.g. 8)" value={filterClass}
                    onChange={(e) => { setFilterClass(e.target.value); setStSearch('') }}
                    className="form-input text-xs" />
                  <input type="text" placeholder="Section (e.g. A)" value={filterSection}
                    onChange={(e) => { setFilterSection(e.target.value); setStSearch('') }}
                    className="form-input text-xs" />
                </div>
                {/* Name search */}
                <input type="text" placeholder="Search student name…" value={studentSearch}
                  onChange={(e) => setStSearch(e.target.value)} className="form-input mb-1.5" />

                {/* Dropdown results */}
                {students.length > 0 && (
                  <div className="border border-slate-200 rounded-lg max-h-44 overflow-y-auto">
                    {students
                      .filter((s) => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                      .slice(0, 10)
                      .map((s: any) => (
                        <button type="button" key={s._id}
                          onClick={() => {
                            setSelStudent(s)
                            setNewObs((p) => ({ ...p, studentId: s._id }))
                            setStSearch(`${s.name} — Class ${s.class}${s.section ? ` ${s.section}` : ''}`)
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 hover:bg-purple-50 border-b border-slate-50 last:border-b-0',
                            newObs.studentId === s._id && 'bg-purple-50',
                          )}>
                          <div className="text-sm font-medium">{s.name}</div>
                          <div className="text-xs text-slate-400">
                            Class {s.class}{s.section ? ` ${s.section}` : ''}{s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                          </div>
                        </button>
                      ))}
                  </div>
                )}

                {selectedStudent && (
                  <div className="mt-2 flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 text-sm">
                    <User2 size={14} className="text-purple-600 shrink-0" />
                    <span className="font-medium text-purple-800">{selectedStudent.name}</span>
                    <span className="text-purple-500">· Class {selectedStudent.class}{selectedStudent.section ? ` ${selectedStudent.section}` : ''}</span>
                    <button onClick={() => { setSelStudent(null); setNewObs(p => ({ ...p, studentId: '' })); setStSearch('') }}
                      className="ml-auto text-purple-400 hover:text-purple-600 text-xs">✕</button>
                  </div>
                )}
              </div>
            ) : (
              /* Manual student entry */
              <div>
                <label className="form-label">Student Details <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Student full name" value={newObs.manualStudentName}
                  onChange={(e) => setNewObs(p => ({ ...p, manualStudentName: e.target.value }))}
                  className="form-input mb-2" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Class (e.g. 8)" value={newObs.manualStudentClass}
                    onChange={(e) => setNewObs(p => ({ ...p, manualStudentClass: e.target.value }))}
                    className="form-input" />
                  <input type="text" placeholder="Section (e.g. A) — optional" value={newObs.manualStudentSection}
                    onChange={(e) => setNewObs(p => ({ ...p, manualStudentSection: e.target.value }))}
                    className="form-input" />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  If the student is already in the system, they will be matched automatically.
                </p>
              </div>
            )}

            {/* Visit date + Class/period */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Visit Date</label>
                <input type="date" value={newObs.classVisitDate}
                  onChange={(e) => setNewObs(p => ({ ...p, classVisitDate: e.target.value }))}
                  className="form-input" />
              </div>
              <div>
                <label className="form-label">Class / Period Observed <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g. Class 8-A, Maths" value={newObs.classObserved}
                  onChange={(e) => setNewObs(p => ({ ...p, classObserved: e.target.value }))}
                  className="form-input" />
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className="form-label">Observations <span className="text-red-500">*</span></label>
              <textarea value={newObs.observations}
                onChange={(e) => setNewObs(p => ({ ...p, observations: e.target.value }))}
                className="form-textarea" rows={5}
                placeholder="Detailed notes on student behaviour, emotional state, interactions, learning engagement, peer relationships…" />
            </div>

            {/* Behaviour flags */}
            <div>
              <label className="form-label">Behaviour Flags</label>
              <div className="flex flex-wrap gap-2">
                {BEHAVIOUR_FLAGS.map((f) => (
                  <button type="button" key={f}
                    onClick={() => setNewObs(p => ({
                      ...p,
                      behaviourFlags: p.behaviourFlags.includes(f)
                        ? p.behaviourFlags.filter((x) => x !== f)
                        : [...p.behaviourFlags, f],
                    }))}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      newObs.behaviourFlags.includes(f)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400')}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Recommend escalation */}
            <div className="flex items-start gap-3 bg-orange-50 rounded-lg p-3">
              <input type="checkbox" id="recEsc" checked={newObs.recommendEscalation}
                onChange={(e) => setNewObs(p => ({ ...p, recommendEscalation: e.target.checked }))}
                className="w-4 h-4 accent-orange-500 mt-0.5" />
              <label htmlFor="recEsc" className="text-sm text-orange-800 cursor-pointer">
                <span className="font-medium">Recommend formal counselling session</span>
                <span className="block text-xs text-orange-600 mt-0.5">Teacher/coordinator will see this flag prominently when reviewing</span>
              </label>
            </div>

            {/* Share with teacher */}
            <div>
              <label className="form-label">Share With (optional — leave blank to save as draft)</label>
              <select value={newObs.sharedWithId}
                onChange={(e) => setNewObs(p => ({ ...p, sharedWithId: e.target.value }))}
                className="form-select">
                <option value="">Save as draft only</option>
                {teachers.map((t: any) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.role === 'CLASS_TEACHER' ? 'Class Teacher' : 'Coordinator'})
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmitObs} disabled={actionLoading} className="btn-primary flex-1 justify-center">
                {actionLoading ? 'Saving…' : newObs.sharedWithId ? '📤 Save & Share' : '💾 Save Draft'}
              </button>
              <button onClick={() => { setShowNew(false); resetForm() }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Review Modal ──────────────────────────────────────────────────── */}
      {reviewing && (
        <Modal title="Review Classroom Observation" onClose={() => { setReviewing(null); setReviewNote('') }}>
          <div className="space-y-4">
            {/* Observation summary */}
            <div className="bg-slate-50 rounded-lg p-4 text-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-900 text-base">{reviewing.studentId?.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Class {reviewing.studentId?.class}{reviewing.studentId?.section ? ` – ${reviewing.studentId.section}` : ''}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Observed: {reviewing.classObserved} · {formatDate(reviewing.classVisitDate)}
                  </div>
                </div>
                {reviewing.recommendEscalation && (
                  <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium shrink-0">
                    <AlertTriangle size={12} /> Escalation Recommended
                  </div>
                )}
              </div>
              <div className="text-xs font-medium text-slate-400 mb-1.5">Psychologist's Notes</div>
              <p className="text-slate-700 leading-relaxed text-sm">{reviewing.observations}</p>
              {reviewing.behaviourFlags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reviewing.behaviourFlags.map((f: string) => (
                    <span key={f} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{f}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Your comment */}
            <div>
              <label className="form-label">Your Comment (optional)</label>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                className="form-textarea" rows={3}
                placeholder="Add context, agree or disagree with the psychologist's assessment…" />
            </div>

            {/* Priority for escalation */}
            <div>
              <label className="form-label">If escalating — Priority Level</label>
              <div className="grid grid-cols-4 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setEscPri(p)}
                    className={cn('py-2 rounded-lg border-2 text-xs font-semibold transition-colors',
                      escalatePriority === p
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <button onClick={() => handleAction(reviewing._id, 'escalate')} disabled={actionLoading}
                className="btn-success flex flex-col items-center justify-center py-4 h-auto gap-1.5">
                <ArrowUpCircle size={20} />
                <span className="text-xs font-medium">Escalate to<br />Counselling</span>
              </button>
              <button onClick={() => handleAction(reviewing._id, 'acknowledge')} disabled={actionLoading}
                className="btn-secondary flex flex-col items-center justify-center py-4 h-auto gap-1.5">
                <CheckCircle2 size={20} />
                <span className="text-xs font-medium">Acknowledge<br />No Action</span>
              </button>
              <button onClick={() => handleAction(reviewing._id, 'decline')} disabled={actionLoading}
                className="btn-danger flex flex-col items-center justify-center py-4 h-auto gap-1.5">
                <XCircle size={20} />
                <span className="text-xs font-medium">Decline<br />Not Relevant</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Modal component ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
        <h3 className="text-lg font-semibold text-slate-900 mb-5">{title}</h3>
        {children}
      </div>
    </div>
  )
}
