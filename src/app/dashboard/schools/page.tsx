'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import type { ISchool } from '@/types'

interface SchoolWithStats extends ISchool {
  totalCases?: number
  activeCases?: number
  urgentCases?: number
}

export default function SchoolsPage() {
  const { data: session } = useSession()

  const [schools, setSchools] = useState<SchoolWithStats[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal
  const [showAddSchool, setShowAddSchool] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    principalName: '',
    principalEmail: '',
    principalPhone: '',
  })

  async function fetchSchools() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/schools?${params}`)
      const data = await res.json()
      setSchools(data.schools || [])
      setTotal(data.pagination?.total || 0)
      setPages(data.pagination?.pages || 1)
    } catch (err) {
      toast.error('Failed to load schools')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSchools()
  }, [page, search])

  async function handleAddSchool() {
    if (!formData.name || !formData.city || !formData.state) {
      toast.error('Please fill in required fields')
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast.success('School added successfully')
        setShowAddSchool(false)
        setFormData({
          name: '',
          code: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          phone: '',
          email: '',
          principalName: '',
          principalEmail: '',
          principalPhone: '',
        })
        setPage(1)
        fetchSchools()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to add school')
      }
    } finally {
      setFormLoading(false)
    }
  }

  const role = session?.user?.role
  if (role !== 'CITTAA_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <p className="text-sm">Only Cittaa Admins can manage schools</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Schools</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAddSchool(true)} className="btn-primary">
          <Plus size={16} /> Add School
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by school name or city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="form-input pl-9 w-full"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Search size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No schools found</div>
            <button
              onClick={() => setShowAddSchool(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Add the first school →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => (
              <div
                key={school._id}
                className="bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-200 transition-colors"
              >
                <h3 className="font-bold text-slate-900 mb-1">{school.name}</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {school.city}, {school.state}
                </p>

                <div className="space-y-2 mb-4 text-sm">
                  {school.address && (
                    <p className="text-slate-600 text-xs">
                      <span className="font-medium">Address:</span> {school.address}
                    </p>
                  )}
                  {school.phone && (
                    <p className="text-slate-600 text-xs">
                      <span className="font-medium">Phone:</span> {school.phone}
                    </p>
                  )}
                  {school.email && (
                    <p className="text-slate-600 text-xs break-all">
                      <span className="font-medium">Email:</span> {school.email}
                    </p>
                  )}
                </div>

                {school.principalName && (
                  <div className="border-t border-slate-100 pt-3 text-xs">
                    <p className="font-medium text-slate-700">{school.principalName}</p>
                    {school.principalEmail && (
                      <p className="text-slate-500 break-all">{school.principalEmail}</p>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="stat-card">
                    <div className="text-lg font-bold text-slate-900">
                      {school.totalCases || 0}
                    </div>
                    <div className="text-xs text-slate-500">Total Cases</div>
                  </div>
                  <div className="stat-card">
                    <div className="text-lg font-bold text-blue-600">
                      {school.activeCases || 0}
                    </div>
                    <div className="text-xs text-slate-500">Active</div>
                  </div>
                  <div className="stat-card">
                    <div className="text-lg font-bold text-red-600">
                      {school.urgentCases || 0}
                    </div>
                    <div className="text-xs text-slate-500">Urgent</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Page {page} of {pages} · {total} schools
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

      {/* Add School Modal */}
      {showAddSchool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add New School</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="form-label">School Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., ABC High School"
                />
              </div>
              <div>
                <label className="form-label">School Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., SCH-001"
                />
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="form-input w-full"
                  placeholder="Full school address"
                />
              </div>

              <div>
                <label className="form-label">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., Mumbai"
                />
              </div>
              <div>
                <label className="form-label">State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., Maharashtra"
                />
              </div>

              <div>
                <label className="form-label">Pincode</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., 400001"
                />
              </div>

              <div>
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., 9876543210"
                />
              </div>

              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input w-full"
                  placeholder="school@example.com"
                />
              </div>

              <div className="md:col-span-2 border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900 mb-3">Principal Information</h3>
              </div>

              <div>
                <label className="form-label">Principal Name</label>
                <input
                  type="text"
                  value={formData.principalName}
                  onChange={(e) =>
                    setFormData({ ...formData, principalName: e.target.value })
                  }
                  className="form-input w-full"
                  placeholder="e.g., John Doe"
                />
              </div>

              <div>
                <label className="form-label">Principal Email</label>
                <input
                  type="email"
                  value={formData.principalEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, principalEmail: e.target.value })
                  }
                  className="form-input w-full"
                  placeholder="principal@example.com"
                />
              </div>

              <div>
                <label className="form-label">Principal Phone</label>
                <input
                  type="tel"
                  value={formData.principalPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, principalPhone: e.target.value })
                  }
                  className="form-input w-full"
                  placeholder="9876543210"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddSchool(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleAddSchool}
                disabled={formLoading}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {formLoading ? 'Adding...' : 'Add School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
