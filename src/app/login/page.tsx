'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Brain, Shield, Users, BookOpen } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (res?.error) {
        toast.error('Invalid email or password')
      } else {
        toast.success('Welcome back!')
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12"
           style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 60%, #7C3AED 100%)' }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Brain size={22} className="text-white" />
            </div>
            <div>
              <div className="cittaa-brand text-white text-xl leading-none">Cittaa</div>
              <div className="text-purple-200 text-xs">Mind Bridge</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            School Counselling<br/>
            <span style={{ color: '#93c5fd' }}>Made Structured.</span>
          </h1>
          <p className="text-purple-100 text-lg leading-relaxed">
            A secure, end-to-end platform for schools and Cittaa psychologists
            to manage student counselling requests, sessions, and assessments.
          </p>
        </div>
        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Shield, label: 'Private & Confidential', desc: 'Role-based access control' },
            { icon: Users,  label: 'Multi-School Network', desc: '20+ school support' },
            { icon: BookOpen, label: 'Full Case Tracking', desc: 'Request to resolution' },
            { icon: Brain, label: 'RCI Coordination', desc: 'Field visits & reports' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white/10 rounded-xl p-4">
              <Icon size={20} className="text-purple-200 mb-2" />
              <div className="text-white text-sm font-medium">{label}</div>
              <div className="text-purple-200 text-xs mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8"
           style={{ background: '#0f172a' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <div className="text-white"><span className="cittaa-brand text-lg">Cittaa</span> <span className="font-semibold text-sm">Mind Bridge</span></div>
              <div className="text-slate-400 text-xs">School Counselling Platform</div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
            <p className="text-slate-400 text-sm mb-8">Enter your credentials to access the platform</p>

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
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-300">
                    Password
                  </label>
                  <Link href="/forgot-password"
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3.5 py-2.5 pr-11
                               text-white placeholder:text-slate-500 text-sm
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

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
                    Signing in…
                  </>
                ) : 'Sign in to Platform'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-700">
              <p className="text-slate-500 text-xs text-center">
                Access is provided by your school admin or Cittaa team.
                <br/>Contact <span className="text-purple-400">support@cittaa.in</span> for help.
              </p>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            © 2024 Cittaa Health Services Pvt. Ltd. · All rights reserved
          </p>
        </div>
      </div>
    </div>
  )
}
