'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  FileText, Calendar, ClipboardList, AlertTriangle, CheckCircle2,
  TrendingUp, School, Clock, ArrowRight, Users, Eye,
  BarChart2, AlertCircle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { cn, PRIORITY_COLORS, STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '@/lib/utils'
import { UpcomingSessions } from '@/components/dashboard/upcoming-sessions'
import type { DashboardStats } from '@/types'

const STATUS_ORDER = [
  'PENDING_APPROVAL', 'APPROVED', 'PSYCHOLOGIST_ASSIGNED',
  'SESSION_SCHEDULED', 'SESSION_COMPLETED',
  'ASSESSMENT_REQUESTED', 'ASSESSMENT_APPROVED',
  'RCI_NOTIFIED', 'RCI_VISITING', 'RCI_REPORT_SUBMITTED',
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  const role = session?.user?.role || ''
  const greeting = getGreeting()

  const isPrincipalView = ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)
  const isCittaaAdmin   = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)
  const showObsPanel    = isPrincipalView || isCittaaAdmin

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const obs = stats?.observations || {}

  return (
    <div className="space-y-6">
      {/* ── Welcome ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {session?.user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {role === 'CITTAA_ADMIN'    && 'Cittaa Admin — viewing all schools'}
            {role === 'CITTAA_SUPPORT'  && 'Cittaa Support — read-only view'}
            {role === 'SCHOOL_PRINCIPAL'&& `Principal — ${session?.user?.schoolName}`}
            {role === 'SCHOOL_ADMIN'    && `School Admin — ${session?.user?.schoolName}`}
            {role === 'COORDINATOR'     && `Coordinator — ${session?.user?.schoolName}`}
            {role === 'CLASS_TEACHER'   && `Class Teacher — ${session?.user?.schoolName}`}
            {role === 'PSYCHOLOGIST'    && 'Psychologist — your active cases'}
            {role === 'RCI_TEAM'        && 'RCI Team — your assigned visits'}
          </p>
        </div>
        {['CLASS_TEACHER', 'COORDINATOR', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role) && (
          <Link href="/dashboard/requests/new" className="btn-primary">
            <FileText size={16} />
            New Request
          </Link>
        )}
      </div>

      {/* ── Counselling Request Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Requests"       value={stats?.totalRequests ?? 0}   icon={FileText}      color="blue"   href="/dashboard/requests" />
        <StatCard label="Pending Approval"      value={stats?.pendingApproval ?? 0} icon={Clock}         color={stats?.pendingApproval ? 'orange' : 'gray'} href="/dashboard/requests?status=PENDING_APPROVAL" badge={stats?.pendingApproval ? 'Action needed' : undefined} />
        <StatCard label="Active Sessions"       value={stats?.activeSessions ?? 0}  icon={Calendar}      color="purple" href="/dashboard/sessions" />
        <StatCard label="Assessments Pending"   value={stats?.assessmentsPending ?? 0} icon={ClipboardList} color={stats?.assessmentsPending ? 'orange' : 'gray'} href="/dashboard/assessments?status=PENDING_APPROVAL" />
        <StatCard label="RCI Pending"           value={stats?.rciPending ?? 0}      icon={TrendingUp}    color={stats?.rciPending ? 'violet' : 'gray'} href="/dashboard/rci" />
        <StatCard label="Urgent Cases"          value={stats?.urgentCases ?? 0}     icon={AlertTriangle} color={stats?.urgentCases ? 'red' : 'gray'} href="/dashboard/requests?priority=URGENT" />
        <StatCard label="Closed This Month"     value={stats?.closedThisMonth ?? 0} icon={CheckCircle2}  color="green"  href="/dashboard/requests?status=CLOSED" />
        {isCittaaAdmin && (
          <StatCard label="Active Schools" value={stats?.schoolCoverage?.length ?? 0} icon={School} color="teal" href="/dashboard/schools" />
        )}
      </div>

      {/* ── Observations Panel (Principal + Cittaa Admin) ─────────────────── */}
      {showObsPanel && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Eye size={17} className="text-indigo-600" />
              <span className="font-semibold text-slate-900">Classroom Observations</span>
            </div>
            <Link href="/dashboard/observations" className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-5 space-y-5">
            {/* Period stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center bg-slate-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-slate-900">{obs.today ?? 0}</div>
                <div className="text-xs text-slate-500 mt-1">Today</div>
              </div>
              <div className="text-center bg-purple-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-700">{obs.thisWeek ?? 0}</div>
                <div className="text-xs text-purple-500 mt-1">This Week</div>
              </div>
              <div className="text-center bg-indigo-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-indigo-700">{obs.thisMonth ?? 0}</div>
                <div className="text-xs text-indigo-500 mt-1">This Month</div>
              </div>
            </div>

            {/* Status mini-badges */}
            {obs.byStatus && Object.keys(obs.byStatus).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'SHARED',       label: 'Awaiting Review', cls: 'bg-yellow-100 text-yellow-700' },
                  { key: 'ESCALATED',    label: 'Escalated',       cls: 'bg-green-100 text-green-700' },
                  { key: 'ACKNOWLEDGED', label: 'Acknowledged',    cls: 'bg-slate-100 text-slate-700' },
                  { key: 'DECLINED',     label: 'Declined',        cls: 'bg-red-100 text-red-700' },
                  { key: 'DRAFT',        label: 'Drafts',          cls: 'bg-slate-100 text-slate-500' },
                ].filter((s) => obs.byStatus[s.key]).map((s) => (
                  <span key={s.key} className={cn('badge text-xs', s.cls)}>
                    {obs.byStatus[s.key]} {s.label}
                  </span>
                ))}
              </div>
            )}

            {/* Class breakdown (Principal only) */}
            {isPrincipalView && obs.classBreakdown?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">This Month by Class</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {obs.classBreakdown.slice(0, 9).map((c: any) => (
                    <Link
                      key={`${c._id.class}-${c._id.section}`}
                      href={`/dashboard/observations?class=${c._id.class}`}
                      className="bg-slate-50 hover:bg-purple-50 rounded-lg px-3 py-2.5 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-800">
                          Class {c._id.class}{c._id.section ? ` ${c._id.section}` : ''}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.count} observation{c.count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {c.escalated > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                            {c.escalated} ↑
                          </span>
                        )}
                        {c.pending > 0 && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                            {c.pending} pending
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {obs.classBreakdown.length > 9 && (
                  <Link href="/dashboard/observations" className="text-xs text-purple-600 hover:text-purple-800 mt-2 inline-block">
                    +{obs.classBreakdown.length - 9} more classes →
                  </Link>
                )}
              </div>
            )}

            {/* Per-school breakdown (Cittaa Admin only) */}
            {isCittaaAdmin && obs.perSchool?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Observations by School</div>
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>School</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">Awaiting Review</th>
                        <th className="text-center">Escalated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obs.perSchool.map((s: any) => (
                        <tr key={s._id}>
                          <td>
                            <div className="font-medium text-sm text-slate-900">{s.schoolName || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{s.schoolCode}</div>
                          </td>
                          <td className="text-center font-semibold text-slate-700">{s.count}</td>
                          <td className="text-center">
                            {s.pending > 0
                              ? <span className="badge bg-yellow-100 text-yellow-700">{s.pending}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="text-center">
                            {s.escalated > 0
                              ? <span className="badge bg-green-100 text-green-700">{s.escalated}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main charts + breakdown ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend chart */}
        {stats?.monthlyTrend && stats.monthlyTrend.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-slate-900">Counselling Request Trend</div>
                <div className="text-xs text-slate-400 mt-0.5">Last 6 months</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.monthlyTrend} barSize={28}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="count" name="Requests" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Status breakdown */}
        {stats?.requestsByStatus && Object.keys(stats.requestsByStatus).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="font-semibold text-slate-900 mb-4">By Status</div>
            <div className="space-y-2">
              {STATUS_ORDER.filter((s) => stats.requestsByStatus[s]).map((status) => (
                <Link
                  key={status}
                  href={`/dashboard/requests?status=${status}`}
                  className="flex items-center justify-between hover:bg-slate-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <span className={cn('badge', STATUS_COLORS[status] || 'bg-gray-100 text-gray-600')}>
                    {STATUS_LABELS[status] || status}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{stats.requestsByStatus[status]}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Upcoming Sessions widget (teacher / coordinator / psychologist) ── */}
      {['CLASS_TEACHER', 'COORDINATOR', 'PSYCHOLOGIST', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role) && (
        <UpcomingSessions />
      )}

      {/* ── School coverage (Cittaa admin) ────────────────────────────────── */}
      {isCittaaAdmin && stats?.schoolCoverage && stats.schoolCoverage.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-slate-900">School Coverage (Requests)</div>
            <Link href="/dashboard/schools" className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.schoolCoverage.map((s: any) => (
              <div key={s._id} className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{s.count}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{s.schoolName}</div>
                <div className="text-xs text-slate-400">{s.schoolCode}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, href, badge
}: {
  label: string; value: number; icon: any; color: string; href: string; badge?: string
}) {
  const colorMap: Record<string, string> = {
    blue:   'bg-purple-50   text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    green:  'bg-green-50  text-green-600',
    red:    'bg-red-50    text-red-600',
    violet: 'bg-violet-50 text-violet-600',
    teal:   'bg-teal-50   text-teal-600',
    gray:   'bg-slate-100 text-slate-500',
  }

  return (
    <Link href={href} className="stat-card hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-sm text-slate-500 mt-1">{label}</div>
          {badge && (
            <div className="mt-2 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full inline-block">
              {badge}
            </div>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl', colorMap[color])}>
          <Icon size={20} />
        </div>
      </div>
    </Link>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
