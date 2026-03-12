'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface UpcomingSession {
  _id: string
  scheduledAt: string
  psychologistId: { name: string }
  substituteId?: { name: string }
  requestId: {
    _id: string
    requestNumber: string
    concernCategory: string
    studentId: { name: string; class: string; section?: string }
    schoolId: { name: string }
  }
}

export function UpcomingSessions() {
  const [sessions, setSessions] = useState<UpcomingSession[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/sessions/reminders')
      .then((r) => r.json())
      .then((d) => setSessions(d.upcoming || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar size={17} className="text-blue-600" />
          <div className="font-semibold text-slate-900 text-sm">Upcoming Sessions</div>
          {sessions.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {sessions.length}
            </span>
          )}
        </div>
        <Link href="/dashboard/sessions" className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Calendar size={24} className="mx-auto mb-2 opacity-30" />
          No sessions in the next 7 days
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sessions.map((s) => {
            const req       = s.requestId as any
            const student   = req?.studentId
            const school    = req?.schoolId
            const psych     = s.substituteId || s.psychologistId
            const hoursUntil = Math.round((new Date(s.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60))
            const isToday   = hoursUntil <= 12
            const isTomorrow = hoursUntil > 12 && hoursUntil <= 36

            return (
              <Link
                key={s._id}
                href={`/dashboard/requests/${req?._id}`}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                {/* Time indicator */}
                <div className={`
                  shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-center
                  ${isToday ? 'bg-red-100 text-red-700' : isTomorrow ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'}
                `}>
                  <div>
                    <div className="text-xs font-bold leading-none">
                      {isToday ? 'Today' : isTomorrow ? 'Tmrw' : formatDateTime(s.scheduledAt).split(',')[0]}
                    </div>
                  </div>
                </div>

                {/* Session details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm text-slate-900 truncate">{student?.name}</div>
                    {isToday && (
                      <span className="shrink-0 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">Today!</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {student?.class}{student?.section ? ` – ${student.section}` : ''} · {school?.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                    <Clock size={11} />
                    {formatDateTime(s.scheduledAt)} · {psych?.name}
                    {s.substituteId && <span className="text-orange-500">(sub)</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
