'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, User, School, Mail, Phone,
  ChevronRight, Save, Edit3, ShieldCheck,
  Calendar, ToggleLeft, ToggleRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  CITTAA_ADMIN:     'Cittaa Admin',
  CITTAA_SUPPORT:   'Cittaa Support',
  SCHOOL_PRINCIPAL: 'School Principal',
  SCHOOL_ADMIN:     'School Admin',
  CLASS_TEACHER:    'Class Teacher',
  COORDINATOR:      'Coordinator',
  PSYCHOLOGIST:     'Psychologist',
  RCI_TEAM:         'RCI Team',
}

const ROLE_COLORS: Record<string, string> = {
  CITTAA_ADMIN:     'bg-purple-100 text-purple-700',
  CITTAA_SUPPORT:   'bg-purple-100 text-purple-700',
  SCHOOL_PRINCIPAL: 'bg-blue-100 text-blue-700',
  SCHOOL_ADMIN:     'bg-blue-100 text-blue-700',
  CLASS_TEACHER:    'bg-green-100 text-green-700',
  COORDINATOR:      'bg-teal-100 text-teal-700',
  PSYCHOLOGIST:     'bg-indigo-100 text-indigo-700',
  RCI_TEAM:         'bg-orange-100 text-orange-700',
}

export default function UserDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const role               = session?.user?.role || ''

  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editMode, setEdit]   = useState(false)

  // Editable
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [isActive, setIsActive] = useState(true)

  const isAdmin = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const isSelf  = session?.user?.id === id

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const u = d.user
        if (!u) return
        setData(u)
        setName(u.name || '')
        setPhone(u.phone || '')
        setIsActive(u.isActive ?? true)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { name, phone }
      if (isAdmin) body.isActive = isActive
      const res = await fetch(`/api/users/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success('User updated')
        setData(result.user)
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
        User not found.{' '}
        <Link href="/dashboard/users" className="text-blue-600 hover:underline">Back</Link>
      </div>
    )
  }

  const school = data.schoolId || {}

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{data.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
            <Link href="/dashboard/users" className="hover:text-blue-600">Users</Link>
            <ChevronRight size={14} />
            <span>{data.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${ROLE_COLORS[data.role] || 'bg-slate-100 text-slate-600'}`}>
            {ROLE_LABELS[data.role] || data.role}
          </span>
          <span className={`badge ${data.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {data.isActive ? 'Active' : 'Inactive'}
          </span>
          {(isAdmin || isSelf) && !editMode && (
            <button onClick={() => setEdit(true)} className="btn-secondary gap-1.5">
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {editMode ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Edit User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" />
            </div>
            {isAdmin && (
              <div className="col-span-2 flex items-center gap-3">
                <label className="form-label mb-0">Active</label>
                <button type="button" onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-slate-600">{isActive ? 'Active' : 'Deactivated'}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : <><Save size={14} /> Save Changes</>}
            </button>
            <button onClick={() => setEdit(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Profile card */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <User size={16} className="text-blue-600" /> Profile
              </h2>

              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                  {data.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{data.name}</div>
                  <div className="text-sm text-slate-500">{ROLE_LABELS[data.role] || data.role}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-0.5">Email</div>
                  <div className="text-slate-800 flex items-center gap-1.5">
                    <Mail size={12} className="text-slate-400" /> {data.email}
                  </div>
                </div>
                {data.phone && (
                  <div>
                    <div className="text-slate-400 text-xs font-medium mb-0.5">Phone</div>
                    <div className="text-slate-800 flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-400" /> {data.phone}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-0.5">Role</div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-slate-400" />
                    <span className={`badge text-xs ${ROLE_COLORS[data.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABELS[data.role] || data.role}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs font-medium mb-0.5">Status</div>
                  <div className="flex items-center gap-1.5 text-sm">
                    {data.isActive
                      ? <><ToggleRight size={14} className="text-green-500" /> <span className="text-green-600">Active</span></>
                      : <><ToggleLeft size={14} className="text-red-400" /> <span className="text-red-500">Inactive</span></>
                    }
                  </div>
                </div>
              </div>
            </div>
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
                  {school.city && <div className="text-slate-500">{school.city}</div>}
                </div>
                {school._id && (
                  <Link href={`/dashboard/schools/${school._id}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2">
                    View school <ChevronRight size={12} />
                  </Link>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" /> Account
              </div>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Created</span>
                  <span className="text-slate-700">{formatDate(data.createdAt)}</span>
                </div>
                {data.lastLogin && (
                  <div className="flex justify-between">
                    <span>Last Login</span>
                    <span className="text-slate-700">{formatDate(data.lastLogin)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
