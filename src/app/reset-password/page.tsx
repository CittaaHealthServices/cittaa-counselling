'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Brain, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get('token') || ''

  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 3000)
      } else {
        toast.error(data.error || 'Something went wrong')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-4">This reset link is invalid or missing. Please request a new one.</p>
        <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300 text-sm">
          Request new link
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
      {success ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
          <p className="text-slate-400 text-sm mb-4">
            Your password has been changed successfully. Redirecting you to login…
          </p>
          <Link href="/login" className="text-purple-400 hover:text-purple-300 text-sm">
            Go to login →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-900/40 rounded-xl flex items-center justify-center">
              <KeyRound size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Set new password</h2>
              <p className="text-slate-400 text-xs">Must be at least 8 characters</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3.5 py-2.5 pr-11
                             text-white placeholder:text-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Re-enter password"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3.5 py-2.5
                           text-white placeholder:text-slate-500 text-sm
                           focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Password strength hint */}
            {password.length > 0 && (
              <div className="flex gap-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    password.length >= [8, 12, 16, 20][i]
                      ? i < 2 ? 'bg-yellow-400' : 'bg-green-400'
                      : 'bg-slate-700'
                  }`} />
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60
                         text-white py-3 rounded-lg font-medium text-sm transition-colors
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Updating…
                </>
              ) : 'Set New Password'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: '#0f172a' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold cittaa-brand">Cittaa</div>
            <div className="text-slate-400 text-xs">Mind Bridge</div>
          </div>
        </div>
        <Suspense fallback={
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 flex items-center justify-center h-48">
            <svg className="animate-spin h-6 w-6 text-purple-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
          </div>
        }>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  )
}
