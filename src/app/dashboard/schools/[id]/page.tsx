'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, School, MapPin, Phone, Mail, User,
  ChevronRight, Save, Users, BookOpen, Edit3,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'

export default function SchoolDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const role               = session?.user?.role || ''

  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editMode, setEdit]   = useState(false)

  // Editable fields
  const [name, setName]                   = useState('')
  const [address, setAddress]             = useState('')
  const [city, setCity]                   = useState('')
  const [state, setState]                 = useState('')
  const [pincode, setPincode]             = useState('')
  const [contactEmail, setContactEmail]   = useState('')
  const [contactPhone, setContactPhone]   = useState('')
  const [principalName, setPrincipalName] = useState('')
  const [board, setBoard]                 = useState('')
  const [isActive, setIsActive]           = useState(true)

  const isAdmin = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)

  useEffect(() => {
    fetch(`/api/schools/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d.school
        if (!s) return
        setData(s)
        setName(s.name || '')
        setAddress(s.address || '')
        setCity(s.city || '')
        setState(s.state || '')
        setPincode(s.pincode || '')
        setContactEmail(s.contactEmail || '')
        setContactPhone(s.contactPhone || '')
        setPrincipalName(s.principalName || '')
        setBoard(s.board || '')
        setIsActive(s.isActive ?? true)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/schools/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name, address, city, state, pincode,
          contactEmail, contactPhone, principalName, board, isActive,
        }),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('School updated')
        setData(result.school)
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
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500">
        School not found.{' '}
        <Link href="/dashboard/schools" className="text-blue-600 hover:underline">Back</Link>
      </div>
    )
  }

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
            <Link href="/dashboard/schools" className="hover:text-blue-600">Schools</Link>
            <ChevronRight size={14} />
            <span>{data.city}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${data.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {data.isActive ? 'Active' : 'Inactive'}
          </span>
          {isAdmin && !editMode && (
            <button onClick={() => setEdit(true)}
              className="btn-secondary gap-1.5">
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {editMode ? (
            /* Edit form */
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <School size={16} className="text-blue-600" /> Edit School Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">School Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Principal Name</label>
                  <input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Board / Affiliation</label>
                  <input value={board} onChange={(e) => setBoard(e.target.value)}
                    placeholder="CBSE, ICSE, State Board..."
                    className="form-input" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">State</label>
                  <input value={state} onChange={(e) => setState(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Pincode</label>
                  <input value={pincode} onChange={(e) => setPincode(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Contact Phone</label>
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="form-input" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Contact Email</label>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="form-input" />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <label className="form-label mb-0">Active</label>
                  <button type="button" onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Saving…' : <><Save size={14} /> Save Changes</>}
                </button>
                <button onClick={() => setEdit(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <School size={16} className="text-blue-600" /> School Information
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {data.principalName && (
                  <div>
                    <div className="text-slate-400 text-xs font-medium mb-0.5">Principal</div>
                    <div className="font-medium text-slate-800">{data.principalName}</div>
                  </div>
                )}
                {data.board && (
                  <div>
                    <div className="text-slate-400 text-xs font-medium mb-0.5">Board</div>
                    <div className="font-medium text-slate-800">{data.board}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-slate-400 text-xs font-medium mb-0.5">Address</div>
                  <div className="text-slate-700 flex items-start gap-1.5">
                    <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    {[data.address, data.city, data.state, data.pincode].filter(Boolean).join(', ')}
                  </div>
                </div>
                {data.contactPhone && (
                  <div>
                    <div className="text-slate-400 text-xs font-medium mb-0.5">Phone</div>
                    <div className="text-slate-700 flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-400" /> {data.contactPhone}
                    </div>
                  </div>
                )}
                {data.contactEmail && (
                  <div>
                    <div className="text-slate-400 text-xs font-medium mb-0.5">Email</div>
                    <div className="text-slate-700 flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-400" /> {data.contactEmail}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick links */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-700 mb-3">Quick Links</div>
            <Link href={`/dashboard/students?schoolId=${id}`}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-1.5">
              <Users size={14} /> View Students
              <ChevronRight size={13} className="ml-auto" />
            </Link>
            <Link href={`/dashboard/users?schoolId=${id}`}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-1.5">
              <User size={14} /> View Staff
              <ChevronRight size={13} className="ml-auto" />
            </Link>
            <Link href={`/dashboard/sessions?schoolId=${id}`}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-1.5">
              <BookOpen size={14} /> View Sessions
              <ChevronRight size={13} className="ml-auto" />
            </Link>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">Added On</div>
            <div className="text-sm text-slate-600">{formatDate(data.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
