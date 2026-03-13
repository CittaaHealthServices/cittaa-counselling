'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Search, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, ROLE_LABELS } from '@/lib/utils'
import type { IUser, ISchool } from '@/types'

const ROLE_COLORS: Record<string, string> = {
  CITTAA_ADMIN: 'bg-red-100 text-red-700',
  SCHOOL_PRINCIPAL: 'bg-purple-100 text-purple-700',
  COORDINATOR: 'bg-purple-100 text-purple-700',
  CLASS_TEACHER: 'bg-yellow-100 text-yellow-700',
  PSYCHOLOGIST: 'bg-green-100 text-green-700',
  RCI_TEAM: 'bg-indigo-100 text-indigo-700',
}

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<IUser[]>([])
  const [schools, setSchools] = useState<ISchool[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')

  // Modal
  const [showAddUser, setShowAddUser] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    schoolId: '',
  })

  const role = session?.user?.role
  const userSchoolId = session?.user?.schoolId
  const isAdmin = role === 'CITTAA_ADMIN'
  const isPrincipal = role === 'SCHOOL_PRINCIPAL'

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (schoolFilter && isAdmin) params.set('schoolId', schoolFilter)
    if (isPrincipal && userSchoolId) params.set('schoolId', userSchoolId)

    try {
      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      setUsers(data.users || [])
      setTotal(data.pagination?.total || 0)
      setPages(data.pagination?.pages || 1)
    } catch (err) {
      toast.error('Failed to load users')
    }
    setLoading(false)
  }, [page, search, schoolFilter, isAdmin, isPrincipal, userSchoolId])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/schools?limit=1000')
        .then((r) => r.json())
        .then((data) => setSchools(data.schools || []))
    }
  }, [isAdmin])

  const getAvailableRoles = () => {
    if (isAdmin) return ['CITTAA_ADMIN', 'SCHOOL_PRINCIPAL', 'COORDINATOR', 'CLASS_TEACHER', 'PSYCHOLOGIST', 'RCI_TEAM']
    if (isPrincipal) return ['COORDINATOR', 'CLASS_TEACHER']
    return []
  }

  async function handleAddUser() {
    if (!formData.name || !formData.email || !formData.role) {
      toast.error('Please fill in required fields')
      return
    }
    const schoolId = isPrincipal ? userSchoolId : formData.schoolId
    if (!schoolId && !isAdmin) {
      toast.error('Please select a school')
      return
    }

    setFormLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          schoolId: schoolId || undefined,
        }),
      })
      if (res.ok) {
        toast.success('User added successfully')
        setShowAddUser(false)
        setFormData({
          name: '',
          email: '',
          phone: '',
          role: '',
          schoolId: '',
        })
        setPage(1)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to add user')
      }
    } finally {
      setFormLoading(false)
    }
  }

  async function handleToggleActive(user: IUser) {
    setToggleLoading(true)
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        toast.success(`User ${!user.isActive ? 'activated' : 'deactivated'}`)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update user')
      }
    } finally {
      setToggleLoading(false)
    }
  }

  if (!isAdmin && !isPrincipal) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <p className="text-sm">You don't have permission to manage users</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
        {(isAdmin || isPrincipal) && (
          <button onClick={() => setShowAddUser(true)} className="btn-primary">
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="form-input pl-9 w-full"
            />
          </div>

          {/* School filter (admin only) */}
          {isAdmin && (
            <select
              value={schoolFilter}
              onChange={(e) => {
                setSchoolFilter(e.target.value)
                setPage(1)
              }}
              className="form-select w-48"
            >
              <option value="">All Schools</option>
              {schools.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Search size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No users found</div>
            {(isAdmin || isPrincipal) && (
              <button
                onClick={() => setShowAddUser(true)}
                className="mt-3 text-sm text-purple-600 hover:text-purple-800"
              >
                Add the first user →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  {isAdmin && <th>School</th>}
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const school = user.schoolId && typeof user.schoolId === 'object' ? user.schoolId : null
                  return (
                    <tr
                      key={user._id}
                      className="cursor-pointer hover:bg-purple-50 transition-colors"
                      onClick={() => router.push(`/dashboard/users/${user._id}`)}
                    >
                      <td className="font-medium text-slate-900 hover:text-purple-700">{user.name}</td>
                      <td className="text-slate-600 text-sm">{user.email}</td>
                      <td className="text-slate-600 text-sm">{user.phone || '—'}</td>
                      <td>
                        <span
                          className={cn('badge', ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-600')}
                        >
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="text-slate-600 text-sm">
                          {school && typeof school === 'object' ? school.name : 'N/A'}
                        </td>
                      )}
                      <td>
                        <span
                          className={cn(
                            'badge',
                            user.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={toggleLoading}
                          className="text-slate-500 hover:text-slate-700 disabled:opacity-40"
                        >
                          {user.isActive ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Page {page} of {pages} · {total} users
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add New User</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., John Doe"
                />
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input w-full"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input w-full"
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="form-label">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="form-select w-full"
                >
                  <option value="">Select a role...</option>
                  {getAvailableRoles().map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div>
                  <label className="form-label">School</label>
                  <select
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    className="form-select w-full"
                  >
                    <option value="">Select a school...</option>
                    {schools.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddUser(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={formLoading}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {formLoading ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
