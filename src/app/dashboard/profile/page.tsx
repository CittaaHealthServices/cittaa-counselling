'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { User, Lock, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROLE_LABELS, cn } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  CITTAA_ADMIN: 'bg-red-100 text-red-700',
  SCHOOL_PRINCIPAL: 'bg-blue-100 text-blue-700',
  COORDINATOR: 'bg-purple-100 text-purple-700',
  CLASS_TEACHER: 'bg-yellow-100 text-yellow-700',
  PSYCHOLOGIST: 'bg-green-100 text-green-700',
  RCI_TEAM: 'bg-indigo-100 text-indigo-700',
}

export default function ProfilePage() {
  const { data: session } = useSession()

  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Edit profile form
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Psychologist availability
  const [isAvailable, setIsAvailable] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  const role = session?.user?.role
  const isPsychologist = role === 'PSYCHOLOGIST'

  useEffect(() => {
    loadUserData()
  }, [])

  async function loadUserData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`)
      const data = await res.json()
      setUserData(data.user)
      setEditName(data.user?.name || '')
      setEditPhone(data.user?.phone || '')
      setIsAvailable(data.user?.isAvailable || false)
    } catch (err) {
      toast.error('Failed to load profile')
    }
    setLoading(false)
  }

  async function handleUpdateProfile() {
    if (!editName.trim()) {
      toast.error('Name is required')
      return
    }
    setEditLoading(true)
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
        }),
      })
      if (res.ok) {
        toast.success('Profile updated successfully')
        loadUserData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update profile')
      }
    } finally {
      setEditLoading(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch(`/api/users/${session?.user?.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      if (res.ok) {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to change password')
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleToggleAvailability() {
    setAvailabilityLoading(true)
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !isAvailable }),
      })
      if (res.ok) {
        setIsAvailable(!isAvailable)
        toast.success(`Marked as ${!isAvailable ? 'available' : 'unavailable'}`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update availability')
      }
    } finally {
      setAvailabilityLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account information</p>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{userData?.name}</h2>
              <p className="text-slate-500 text-sm">{userData?.email}</p>
              <div className="mt-2">
                <span className={cn('badge', ROLE_COLORS[userData?.role] || 'bg-slate-100 text-slate-600')}>
                  {ROLE_LABELS[userData?.role]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500 font-medium mb-1">Phone</div>
            <div className="text-slate-900 font-medium">{userData?.phone || 'Not provided'}</div>
          </div>
          {userData?.schoolId && (
            <div>
              <div className="text-xs text-slate-500 font-medium mb-1">School</div>
              <div className="text-slate-900 font-medium">
                {typeof userData.schoolId === 'object' ? userData.schoolId.name : 'School Associated'}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-slate-500 font-medium mb-1">Account Status</div>
            <div className="text-slate-900 font-medium">
              <span
                className={cn(
                  'badge',
                  userData?.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}
              >
                {userData?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <User size={20} /> Edit Profile
        </h3>

        <div className="space-y-4">
          <div>
            <label className="form-label">Full Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="form-input w-full"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="form-label">Phone</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="form-input w-full"
              placeholder="Your phone number"
            />
          </div>

          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={userData?.email || ''}
              disabled
              className="form-input w-full bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
          </div>

          <button
            onClick={handleUpdateProfile}
            disabled={editLoading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {editLoading ? 'Updating...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Lock size={20} /> Change Password
        </h3>

        <div className="space-y-4">
          <div className="relative">
            <label className="form-label">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input w-full pr-10"
                placeholder="Enter your current password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="relative">
            <label className="form-label">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input w-full pr-10"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="relative">
            <label className="form-label">Confirm Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input w-full pr-10"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">Password must be at least 6 characters</p>

          <button
            onClick={handleChangePassword}
            disabled={passwordLoading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {passwordLoading ? 'Updating...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Availability Section (Psychologist Only) */}
      {isPsychologist && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            Availability Status
          </h3>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Mark yourself as available or unavailable for new session assignments.
            </p>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <div className="font-semibold text-slate-900">
                  {isAvailable ? 'You are available' : 'You are unavailable'}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {isAvailable
                    ? 'You can be assigned new sessions'
                    : 'You will not be assigned new sessions'}
                </p>
              </div>
              <button
                onClick={handleToggleAvailability}
                disabled={availabilityLoading}
                className="text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                {isAvailable ? (
                  <ToggleRight size={32} className="text-green-600" />
                ) : (
                  <ToggleLeft size={32} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
