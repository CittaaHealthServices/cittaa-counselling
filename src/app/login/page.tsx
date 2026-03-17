'use client'
import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { Brain, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { status } = useSession()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const getCallbackUrl = () => {
    if (typeof window === 'undefined') return '/dashboard'
    const params = new URLSearchParams(window.location.search)
    const cb = params.get('callbackUrl') || '/dashboard'
    return cb.startsWith('/') ? cb : '/dashboard'
  }

  // Redirect if already authenticated — but NEVER block the form
  useEffect(() => {
    if (status === 'authenticated') {
      setRedirecting(true)
      window.location.replace(getCallbackUrl())
    }
  }, [status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || redirecting) return
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
    }
    // On success: useSession flips to 'authenticated', useEffect fires redirect
  }

  const isBusy = loading || redirecting

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center mb-3">
              <Brain size={28} className="text-purple-300" />
            </div>
            <h1 className="text-2xl font-bold text-white">Cittaa</h1>
            <p className="text-purple-300 text-sm mt-0.5">MindBridge™ School Counselling Platform</p>
          </div>

          {/* Subtle redirecting banner — doesn't block the form */}
          {redirecting && (
            <div className="flex items-center justify-center gap-2 mb-4 bg-purple-500/20 border border-purple-400/30 rounded-xl px-4 py-2.5">
              <Loader2 size={14} className="text-purple-300 animate-spin" />
              <span className="text-purple-200 text-sm">Redirecting to dashboard…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1.5">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isBusy}
                placeholder="you@school.edu.in"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isBusy}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-11 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full bg-purple-500 hover:bg-purple-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm mt-2"
            >
              {isBusy && <Loader2 size={16} className="animate-spin" />}
              {redirecting ? 'Redirecting…' : loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-white/30 text-xs mt-6">
            Secure access · Cittaa Health Services Pvt. Ltd.
          </p>
        </div>
      </div>
    </div>
  )
}
