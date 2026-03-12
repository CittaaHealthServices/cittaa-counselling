'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Search, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import type { IStudent } from '@/types'

export default function StudentsPage() {
  const { data: session } = useSession()

  const [students, setStudents] = useState<IStudent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')

  // Modals
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  // Single student form
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    class: '',
    section: '',
    age: '',
    gender: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
  })

  // Bulk import
  const [csvText, setCsvText] = useState('')
  const [csvLoading, setCsvLoading] = useState(false)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (classFilter) params.set('class', classFilter)

    try {
      const res = await fetch(`/api/students?${params}`)
      const data = await res.json()
      setStudents(data.students || [])
      setTotal(data.pagination?.total || 0)
      setPages(data.pagination?.pages || 1)
    } catch (err) {
      toast.error('Failed to load students')
    }
    setLoading(false)
  }, [page, search, classFilter])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  async function handleAddStudent() {
    if (!formData.name || !formData.class) {
      toast.error('Please fill in required fields')
      return
    }

    setFormLoading(true)
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age) : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Student added successfully')
        setShowAddStudent(false)
        setFormData({
          name: '',
          rollNumber: '',
          class: '',
          section: '',
          age: '',
          gender: '',
          parentName: '',
          parentPhone: '',
          parentEmail: '',
        })
        setPage(1)
        fetchStudents()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to add student')
      }
    } finally {
      setFormLoading(false)
    }
  }

  function parseCSV(text: string): any[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      toast.error('CSV must have header and at least one data row')
      return []
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rows = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim())
      if (!values.some((v) => v)) continue // Skip empty rows

      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      rows.push(row)
    }

    return rows
  }

  async function handleBulkImport() {
    const rows = parseCSV(csvText)
    if (rows.length === 0) return

    setCsvLoading(true)
    try {
      const students = rows.map((row) => ({
        name: row.name || '',
        rollNumber: row.rollnumber || row['roll number'] || '',
        class: row.class || '',
        section: row.section || '',
        age: row.age ? parseInt(row.age) : undefined,
        gender: row.gender || '',
        parentName: row.parentname || row['parent name'] || '',
        parentPhone: row.parentphone || row['parent phone'] || '',
        parentEmail: row.parentemail || row['parent email'] || '',
      }))

      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.imported || 0} students imported successfully`)
        if (data.failed > 0) {
          toast.error(`${data.failed} students failed to import`)
        }
        setShowBulkImport(false)
        setCsvText('')
        setPage(1)
        fetchStudents()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to import students')
      }
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{total} total · {pages} page{pages > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulkImport(true)} className="btn-secondary">
            <Upload size={16} /> Bulk Import
          </button>
          <button onClick={() => setShowAddStudent(true)} className="btn-primary">
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or roll number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="form-input pl-9 w-full"
            />
          </div>

          {/* Class filter */}
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value)
              setPage(1)
            }}
            className="form-select w-40"
          >
            <option value="">All Classes</option>
            {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Search size={32} className="mb-2 opacity-40" />
            <div className="text-sm">No students found</div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowAddStudent(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Add a student →
              </button>
              <span className="text-xs text-slate-400">or</span>
              <button
                onClick={() => setShowBulkImport(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Import CSV →
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No.</th>
                  <th>Class</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Parent Name</th>
                  <th>Parent Phone</th>
                  <th>Parent Email</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student._id}>
                    <td className="font-medium text-slate-900">{student.name}</td>
                    <td className="text-slate-600 text-sm">{student.rollNumber || '—'}</td>
                    <td className="text-slate-600 text-sm">
                      {student.class}
                      {student.section ? ` – ${student.section}` : ''}
                    </td>
                    <td className="text-slate-600 text-sm">{student.age || '—'}</td>
                    <td className="text-slate-600 text-sm">{student.gender || '—'}</td>
                    <td className="text-slate-600 text-sm">{student.parentName || '—'}</td>
                    <td className="text-slate-600 text-sm text-xs">{student.parentPhone || '—'}</td>
                    <td className="text-slate-600 text-sm text-xs break-all">
                      {student.parentEmail || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Page {page} of {pages} · {total} students
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

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add New Student</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., Rajesh Kumar"
                />
              </div>

              <div>
                <label className="form-label">Roll Number</label>
                <input
                  type="text"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., A-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Class *</label>
                  <select
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="form-select w-full"
                  >
                    <option value="">Select...</option>
                    {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Section</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="form-select w-full"
                  >
                    <option value="">Select...</option>
                    {['A', 'B', 'C', 'D', 'E'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="form-input w-full"
                    placeholder="14"
                  />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="form-select w-full"
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Parent Name</label>
                <input
                  type="text"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  className="form-input w-full"
                  placeholder="e.g., Sharma"
                />
              </div>

              <div>
                <label className="form-label">Parent Phone</label>
                <input
                  type="tel"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="form-input w-full"
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="form-label">Parent Email</label>
                <input
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  className="form-input w-full"
                  placeholder="parent@example.com"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddStudent(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={formLoading}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {formLoading ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Bulk Import Students</h2>

            <div className="space-y-4 mb-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">CSV Format</h3>
                <p className="text-xs text-slate-600 mb-2">
                  Your CSV file should have the following columns (comma-separated):
                </p>
                <div className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
                  name, rollNumber, class, section, age, gender, parentName, parentPhone, parentEmail
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Example CSV</h3>
                <div className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
                  {`name,rollNumber,class,section,age,gender,parentName,parentPhone,parentEmail
Rajesh Kumar,A-01,IX,A,14,Male,Sharma,9876543210,parent@email.com
Priya Singh,A-02,IX,A,13,Female,Singh,9876543211,parent2@email.com`}
                </div>
              </div>

              <div>
                <label className="form-label">Paste CSV Data</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Paste your CSV data here..."
                  className="form-textarea w-full"
                  rows={8}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowBulkImport(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={csvLoading || !csvText.trim()}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {csvLoading ? 'Importing...' : 'Import Students'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
