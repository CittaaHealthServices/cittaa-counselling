'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, User, School, Phone, Mail, Calendar,
  ChevronRight, Save, Edit3, ClipboardList, Eye,
  BookOpen, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'

export default function StudentDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const role               = session?.user?.role || ''

  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editMode, setEdit]   = useState(false)

  // Editable fields
  const [name, setName]               = useState('')
  const [gender, setGender]           = useState('')
  const [cls, setCls]                 = useState('')
  const [section, setSection]         = useState('')
  const [rollNumber, setRoll]         = useState('')
  const [dob, setDob]                 = useState('')
  const [parentName, setParentName]   = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [address, setAddress]         = useState('')
  const [medicalNotes, setMedical]    = useState('')

  const isAdmin    = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const isPrincipal = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)
  const isCoord    = role === 'COORDINATOR'
  const canEdit    = isAdmin || isPrincipal || isCoord

  useEffect(() => {
    fetch(`/api/students/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d.student
        if (!s) return
        setData(s)
        setName(s.name || '')
        setGender(s.gender || '')
        setCls(s.class || '')
        setSection(s.section || '')
        setRoll(s.rollNumber || '')
        setDob(s.dob ? s.dob.split('T')[0] : '')
        setParentName(s.parentName || '')
        setParentPhone(s.parentPhone || '')
        setParentEmail(s.parentEmail || '')
        setAddress(s.address || '')
        setMedical(s.medicalNotes || '')
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { name, gender, class: cls, section, rollNumber, parentName, parentPhone, parentEmail, address, medicalNotes }
      if (dob) body.dob = dob
      const res = await fetch(`/api/students/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('Student updated')
        setData(result.student)
        setEdit(false)
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
        Student not found.{' '}
        <Link href="/dashboard/students" className="text-purple-600 hover:underline">Back</Link>
      </div>
    )
  }

  const school = data.schoolId || {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{data.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
            <Link href="/dashboard/students" className="hover:text-purple-600">Students</Link>
            <ChevronRight size={14} />
            <span>Class {data.class}{data.section ? ` – ${data.section}` : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${data.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {data.isActive !== false ? 'Active' : 'Inactive'}
          </span>
          {canEdit && !editMode && (
            <button onClick={() => setEdit(true)} className="btn-secondary gap-1.5">
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {editMode ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800">Edit Student Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="form-select">
                    <option value="">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Class</label>
                  <input value={cls} onChange={(e) => setCls(e.target.value)} className="form-input" placeholder="e.g. 8" />
                </div>
                <div>
                  <label className="form-label">Section</label>
                  <input value={section} onChange={(e) => setSection(e.target.value)} className="form-input" placeholder="e.g. A" />
                </div>
                <div>
                  <label className="form-label">Roll Number</label>
                  <input value={rollNumber} onChange={(e) => setRoll(e.target.value)} className="form-input" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Parent / Guardian Name</label>
                  <input value={parentName} onChange={(e) => setParentName(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Parent Phone</label>
                  <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Parent Email</label>
                  <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className="form-input" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Medical Notes (confidential)</label>
                  <textarea value={medicalNotes} onChange={(e) => setMedical(e.target.value)}
                    rows={3} className="form-textarea w-full"
                    placeholder="Any relevant medical or special needs information..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Saving…' : <><Save size={14} /> Save Changes</>}
                </button>
                <button onClick={() => setEdit(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {/* Student info card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <User size={16} className="text-purple-600" /> Student Information
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs font-medium mb-0.5">Class & Section</div>
                    <div className="font-medium text-slate-800">
                      Class {data.class}{data.section ? ` – ${data.section}` : ''}
                    </div>
                  </div>
                  {data.rollNumber && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-0.5">Roll Number</div>
                      <div className="font-medium text-slate-800">{data.rollNumber}</div>
                    </div>
                  )}
                  {data.gender && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-0.5">Gender</div>
                      <div className="font-medium text-slate-800 capitalize">{data.gender.toLowerCase()}</div>
                    </div>
                  )}
                  {data.dob && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-0.5">Date of Birth</div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" /> {formatDate(data.dob)}
                      </div>
                    </div>
                  )}
                  {data.age && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-0.5">Age</div>
                      <div className="font-medium text-slate-800">{data.age} years</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Parent info */}
              {(data.parentName || data.parentPhone || data.parentEmail) && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <User size={16} className="text-purple-600" /> Parent / Guardian
                  </h2>
                  <div className="text-sm space-y-2">
                    {data.parentName && <div className="font-medium text-slate-900">{data.parentName}</div>}
                    {data.parentPhone && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone size={13} className="text-slate-400" /> {data.parentPhone}
                      </div>
                    )}
                    {data.parentEmail && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail size={13} className="text-slate-400" /> {data.parentEmail}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Medical notes (visible to admin/psychologist/principal) */}
              {data.medicalNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-amber-700 font-medium text-sm mb-1">Medical / Special Needs Notes</div>
                  <div className="text-amber-800 text-sm whitespace-pre-wrap">{data.medicalNotes}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
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

          {/* Activity links */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-700 mb-3">Activity</div>
            <Link href={`/dashboard/requests?studentId=${id}`}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 py-1.5">
              <FileText size={14} /> Counselling Requests
              <ChevronRight size={13} className="ml-auto" />
            </Link>
            <Link href={`/dashboard/sessions?studentId=${id}`}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 py-1.5">
              <BookOpen size={14} /> Sessions
              <ChevronRight size={13} className="ml-auto" />
            </Link>
            <Link href={`/dashboard/observations?studentId=${id}`}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 py-1.5">
              <Eye size={14} /> Observations
              <ChevronRight size={13} className="ml-auto" />
            </Link>
            <Link href={`/dashboard/assessments?studentId=${id}`}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 py-1.5">
              <ClipboardList size={14} /> Assessments
              <ChevronRight size={13} className="ml-auto" />
            </Link>
          </div>

          {/* Added date */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">Enrolled</div>
            <div className="text-sm text-slate-600">{formatDate(data.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
