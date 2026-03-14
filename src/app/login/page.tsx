'use client'
import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { status } = useSession()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [waitingRedirect, setWaitingRedirect] = useState(false)
  const [error, setError]       = useState('')

  // ── Redirect as soon as NextAuth confirms the session ───────────────────
  // Fires when: (a) user just signed in, or (b) already-logged-in user visits /login.
  // status === 'authenticated' is only set AFTER the session cookie is fully
  // committed + verified by NextAuth — making this timing-safe.
  // window.location.href alone races against that commit and can lose.
  useEffect(() => {
    if (status === 'authenticated') {
      window.location.replace('/dashboard')
    }
  }, [status])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || waitingRedirect) return
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email:    email.trim().toLowerCase(),
        password,
      })

      if (!result?.ok || result.error) {
        setError(
          result?.error === 'CredentialsSignin'
            ? 'Invalid email or password. Please check and try again.'
            : result?.error || 'Login failed. Please try again.'
        )
        return
      }

      // signIn succeeded — show spinner while useSession propagates and
      // the useEffect above triggers window.location.replace('/dashboard')
      setWaitingRedirect(true)

    } catch {
      setError('Something went wrong. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Full-screen spinner while session propagates / redirect in progress
  if (waitingRedirect || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900">
        <div className="text-center">
          <Loader2 className="animate-spin text-purple-300 mx-auto mb-3" size={36} />
          <p className="text-purple-200 text-sm">Signing you in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900 px-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm border border-white/20">
            <span className="text-2xl font-bold text-white">C</span>
          </div>
          <h1
            className="text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Kaushan Script', cursive" }}
          >
            Cittaa
          </h1>
          <p className="text-purple-300 text-sm mt-1">MindBridge™ School Mental Health Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-purple-200 mb-1.5 font-medium">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@school.edu.in"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/60 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm text-purple-200 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/60 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-purple-300 hover:text-white transition">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || waitingRedirect}
              className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in…</>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-purple-400/60 text-xs mt-6">
          © {new Date().getFullYear()} Cittaa Health Services Pvt. Ltd.
        </p>
      </div>
    </div>
  )
}
