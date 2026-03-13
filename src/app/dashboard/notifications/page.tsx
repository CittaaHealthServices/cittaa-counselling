'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell, CheckCheck, ExternalLink, Loader2,
  FileText, ClipboardList, Calendar, Eye, Map,
  Info,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, typeof Bell> = {
  NEW_REQUEST:          FileText,
  REQUEST_ASSIGNED:     FileText,
  REQUEST_APPROVED:     FileText,
  REQUEST_REJECTED:     FileText,
  SESSION_SCHEDULED:    Calendar,
  SESSION_REMINDER:     Calendar,
  ASSESSMENT_APPROVED:  ClipboardList,
  ASSESSMENT_REJECTED:  ClipboardList,
  RCI_ASSIGNED:         Map,
  RCI_REPORT_READY:     Map,
  OBSERVATION_SHARED:   Eye,
  GENERAL:              Info,
}

const TYPE_COLORS: Record<string, string> = {
  NEW_REQUEST:         'bg-blue-100 text-blue-600',
  REQUEST_ASSIGNED:    'bg-indigo-100 text-indigo-600',
  REQUEST_APPROVED:    'bg-green-100 text-green-600',
  REQUEST_REJECTED:    'bg-red-100 text-red-600',
  SESSION_SCHEDULED:   'bg-purple-100 text-purple-600',
  SESSION_REMINDER:    'bg-amber-100 text-amber-600',
  ASSESSMENT_APPROVED: 'bg-green-100 text-green-600',
  ASSESSMENT_REJECTED: 'bg-red-100 text-red-600',
  RCI_ASSIGNED:        'bg-orange-100 text-orange-600',
  RCI_REPORT_READY:    'bg-teal-100 text-teal-600',
  OBSERVATION_SHARED:  'bg-sky-100 text-sky-600',
  GENERAL:             'bg-slate-100 text-slate-600',
}

interface Notification {
  _id: string
  title: string
  message: string
  type: string
  isRead: boolean
  link?: string
  createdAt: string
}

export default function NotificationsPage() {
  const router = useRouter()

  const [notifs, setNotifs]       = useState<Notification[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [pages, setPages]         = useState(1)
  const [total, setTotal]         = useState(0)
  const [marking, setMarking]     = useState(false)
  const [filter, setFilter]       = useState<'all' | 'unread'>('all')

  const fetchNotifs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter === 'unread') params.set('unread', 'true')
      const res  = await fetch(`/api/notifications?${params}`)
      const data = await res.json()
      setNotifs(data.notifications || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  async function markAllRead() {
    setMarking(true)
    try {
      await fetch('/api/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ markAll: true }),
      })
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } finally {
      setMarking(false)
    }
  }

  async function markOneRead(id: string) {
    await fetch('/api/notifications', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ notificationId: id }),
    })
    setNotifs((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    )
  }

  function handleClick(notif: Notification) {
    if (!notif.isRead) markOneRead(notif._id)
    if (notif.link) router.push(notif.link)
  }

  const unreadCount = notifs.filter((n) => !n.isRead).length

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Bell size={20} className="text-blue-600" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total notifications</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => { setFilter('all'); setPage(1) }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              All
            </button>
            <button
              onClick={() => { setFilter('unread'); setPage(1) }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              Unread
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="btn-secondary gap-1.5 text-sm"
            >
              {marking
                ? <Loader2 size={14} className="animate-spin" />
                : <CheckCheck size={14} />
              }
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={40} className="mx-auto text-slate-300 mb-3" />
            <div className="text-slate-500 font-medium">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </div>
          </div>
        ) : (
          notifs.map((notif) => {
            const Icon  = TYPE_ICONS[notif.type] || Info
            const color = TYPE_COLORS[notif.type] || 'bg-slate-100 text-slate-600'
            return (
              <div
                key={notif._id}
                onClick={() => handleClick(notif)}
                className={cn(
                  'flex items-start gap-4 px-5 py-4 transition-colors',
                  notif.link ? 'cursor-pointer hover:bg-slate-50' : '',
                  !notif.isRead ? 'bg-blue-50/40' : ''
                )}
              >
                {/* Icon */}
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', color)}>
                  <Icon size={16} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-900 text-sm leading-snug">
                      {notif.title}
                    </div>
                    <div className="text-xs text-slate-400 shrink-0 mt-0.5">
                      {formatDate(notif.createdAt)}
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">
                    {notif.message}
                  </p>
                  {notif.link && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                      <ExternalLink size={11} /> View details
                    </span>
                  )}
                </div>

                {/* Unread dot */}
                {!notif.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Page {page} of {pages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="btn-secondary disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
