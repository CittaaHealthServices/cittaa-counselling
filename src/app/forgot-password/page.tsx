'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Brain, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Something went wrong')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: '#0f172a' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold cittaa-brand">Cittaa</div>
            <div className="text-slate-400 text-xs">Mind Bridge</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                If an account exists for <span className="text-white font-medium">{email}</span>,
                you will receive a password reset link shortly. The link is valid for 1 hour.
              </p>
              <Link href="/login"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                <ArrowLeft size={14} />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-900/40 rounded-xl flex items-center justify-center">
                  <Mail size={20} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Forgot password?</h2>
                  <p className="text-slate-400 text-xs">Enter your email to receive a reset link</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@school.edu.in"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3.5 py-2.5
                               text-white placeholder:text-slate-500 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                             text-white py-3 rounded-lg font-medium text-sm transition-colors
                             flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                      </svg>
                      Sending…
                    </>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-700 text-center">
                <Link href="/login"
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                  <ArrowLeft size={14} />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
