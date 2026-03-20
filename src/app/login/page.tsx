'use client'
import { useState, useEffect } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Brain, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Suspense } from 'react'

// ── Google SVG icon ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}

const ERROR_MESSAGES: Record<string, string> = {
  DomainNotAllowed: 'Google sign-in is only available for @cittaa.in accounts.',
  AccountNotFound:  'No active Cittaa staff account found for this Google email. Contact your admin.',
  OAuthAccountNotLinked: 'This email is already registered with a password. Please sign in with your password.',
  ServerError:      'A server error occurred. Please try again.',
  default:          'Sign-in failed. Please try again.',
}

// ── Inner component (uses useSearchParams — needs Suspense) ───────────────────
function LoginContent() {
  const { status }     = useSession()
  const searchParams   = useSearchParams()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [gLoading,   setGLoading]   = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Surface OAuth errors from URL (e.g. ?error=DomainNotAllowed)
  useEffect(() => {
    const e = searchParams.get('error')
    if (e) setError(ERROR_MESSAGES[e] ?? ERROR_MESSAGES.default)
  }, [searchParams])

  const getCallbackUrl = () => {
    if (typeof window === 'undefined') return '/dashboard'
    const params = new URLSearchParams(window.location.search)
    const cb = params.get('callbackUrl') || '/dashboard'
    return cb.startsWith('/') ? cb : '/dashboard'
  }

  // Stale-session detection
  useEffect(() => {
    if (status === 'authenticated') {
      const attempts = parseInt(sessionStorage.getItem('_ra') || '0')
      if (attempts >= 1) {
        sessionStorage.removeItem('_ra')
        setSigningOut(true)
        signOut({ redirect: false }).then(() => setSigningOut(false))
        return
      }
      sessionStorage.setItem('_ra', '1')
      window.location.replace(getCallbackUrl())
    }
    if (status === 'unauthenticated') {
      sessionStorage.removeItem('_ra')
    }
  }, [status])

  // Credentials sign-in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
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
    } else {
      sessionStorage.removeItem('_ra')
      window.location.replace(getCallbackUrl())
    }
  }

  // Google sign-in
  const handleGoogle = async () => {
    setGLoading(true)
    setError('')
    await signIn('google', { callbackUrl: getCallbackUrl() })
  }

  if (status === 'loading' || signingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900">
        <Loader2 size={32} className="text-purple-300 animate-spin" />
      </div>
    )
  }

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
            <p className="text-purple-300 text-sm mt-0.5">MindBridge · School Counselling Platform</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* ── Google sign-in (Cittaa staff) ── */}
          <div className="mb-5">
            <p className="text-purple-300/70 text-xs text-center mb-3 font-medium tracking-wide uppercase">
              Cittaa Staff
            </p>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={gLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 font-semibold py-3 rounded-xl transition text-sm shadow-sm"
            >
              {gLoading
                ? <Loader2 size={16} className="animate-spin text-gray-500" />
                : <GoogleIcon />}
              {gLoading ? 'Redirecting to Google…' : 'Sign in with Google'}
            </button>
            <p className="text-center text-white/25 text-xs mt-2">Only @cittaa.in accounts are accepted</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or sign in with password</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Credentials form (schools + all roles) ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1.5">Email address or username</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@school.edu.in or your username"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
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
            <button
              type="submit"
              disabled={loading || gLoading}
              className="w-full bg-purple-500 hover:bg-purple-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm mt-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
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

// ── Default export wrapped in Suspense (required for useSearchParams) ─────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900">
        <Loader2 size={32} className="text-purple-300 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
