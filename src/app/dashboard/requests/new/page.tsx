'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { CONCERN_CATEGORIES } from '@/types'

export default function NewRequestPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState<any[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  const [form, setForm] = useState({
    studentId:       '',
    concernCategory: '',
    description:     '',
    priority:        'MEDIUM',
    isConfidential:  false,
  })

  useEffect(() => {
    if (studentSearch.length >= 2) {
      fetch(`/api/students?search=${encodeURIComponent(studentSearch)}`)
        .then((r) => r.json())
        .then((d) => setStudents(d.students || []))
    } else if (studentSearch === '') {
      fetch('/api/students?limit=50')
        .then((r) => r.json())
        .then((d) => setStudents(d.students || []))
    }
  }, [studentSearch])

  useEffect(() => {
    fetch('/api/students?limit=50')
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.studentId || !form.concernCategory || !form.description.trim()) {
      toast.error('Please fill all required fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Request ${data.request.requestNumber} submitted successfully`)
        router.push(`/dashboard/requests/${data.request._id}`)
      } else {
        toast.error(data.error || 'Failed to submit request')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/requests" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="page-title">New Counselling Request</h1>
          <p className="page-subtitle">Submit a student for counselling support</p>
        </div>
      </div>

      {/* URGENT note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Confidentiality notice:</strong> This request will be reviewed by the school principal before being assigned to a psychologist.
          Toggle "Confidential" if you do not want your name visible to students/parents.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {/* Student selector */}
        <div>
          <label className="form-label">Student <span className="text-red-500">*</span></label>
          <input
            type="text"
            placeholder="Type student name to search…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="form-input mb-2"
          />
          {students.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {students.map((s) => (
                <button
                  type="button"
                  key={s._id}
                  onClick={() => {
                    setForm({ ...form, studentId: s._id })
                    setStudentSearch(`${s.name} — Class ${s.class}${s.section ? ` ${s.section}` : ''}`)
                    setStudents([])
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0
                    ${form.studentId === s._id ? 'bg-blue-50' : ''}`}
                >
                  <div className="font-medium text-sm text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-400">
                    Class {s.class}{s.section ? ` – ${s.section}` : ''}
                    {s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
          {form.studentId && (
            <div className="mt-2 inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs px-3 py-1.5 rounded-full">
              ✓ Student selected
              <button type="button" onClick={() => { setForm({...form, studentId: ''}); setStudentSearch('') }} className="text-green-500 hover:text-green-700">×</button>
            </div>
          )}
        </div>

        {/* Concern category */}
        <div>
          <label className="form-label">Concern Category <span className="text-red-500">*</span></label>
          <select
            value={form.concernCategory}
            onChange={(e) => setForm({ ...form, concernCategory: e.target.value })}
            className="form-select"
            required
          >
            <option value="">Select a concern category</option>
            {CONCERN_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="form-label">
            Description <span className="text-red-500">*</span>
            <span className="text-slate-400 font-normal ml-1">(provide context — visible to psychologist, not students)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="form-textarea"
            rows={5}
            required
            placeholder="Describe the student's situation, observed behaviours, duration, any known triggers, previous incidents..."
          />
          <div className="text-xs text-slate-400 mt-1">{form.description.length} characters</div>
        </div>

        {/* Priority */}
        <div>
          <label className="form-label">Priority Level</label>
          <div className="grid grid-cols-4 gap-2">
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => {
              const colorMap = {
                LOW:    'border-slate-300 text-slate-600 bg-slate-50',
                MEDIUM: 'border-blue-300 text-blue-700 bg-blue-50',
                HIGH:   'border-orange-300 text-orange-700 bg-orange-50',
                URGENT: 'border-red-300 text-red-700 bg-red-50',
              }
              const selectedMap = {
                LOW:    'border-slate-500 bg-slate-100',
                MEDIUM: 'border-blue-500 bg-blue-100',
                HIGH:   'border-orange-500 bg-orange-100',
                URGENT: 'border-red-500 bg-red-100',
              }
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p })}
                  className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-colors
                    ${form.priority === p ? selectedMap[p] + ' ring-2 ring-offset-1 ring-' + p.toLowerCase() : colorMap[p]}`}
                >
                  {p}
                </button>
              )
            })}
          </div>
          {form.priority === 'URGENT' && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              Urgent requests are flagged to the principal for immediate attention.
            </div>
          )}
        </div>

        {/* Confidential */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="confidential"
            checked={form.isConfidential}
            onChange={(e) => setForm({ ...form, isConfidential: e.target.checked })}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="confidential" className="text-sm text-slate-700 cursor-pointer">
            Mark as confidential
            <span className="text-slate-400 ml-1 text-xs">(your name will be hidden from student-facing communications)</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <Link href="/dashboard/requests" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
