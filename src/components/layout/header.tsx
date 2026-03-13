'use client'
import { useState, useEffect, useRef } from 'react'
import { Bell, Menu, CheckCheck } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { formatDate, timeAgo } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Notification {
  _id: string
  title: string
  message: string
  isRead: boolean
  link?: string
  createdAt: string
}

interface HeaderProps {
  onMenuClick: () => void
  title?: string
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [notifs, setNotifs]     = useState<Notification[]>([])
  const [unread, setUnread]     = useState(0)
  const [open, setOpen]         = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifs(data.notifications || [])
        setUnread(data.unreadCount || 0)
      }
    } catch {}
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ markAll: true }), headers: { 'Content-Type': 'application/json' } })
    setNotifs(notifs.map((n) => ({ ...n, isRead: true })))
    setUnread(0)
  }

  async function handleNotifClick(notif: Notification) {
    if (!notif.isRead) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ ids: [notif._id] }),
        headers: { 'Content-Type': 'application/json' },
      })
      setNotifs(notifs.map((n) => n._id === notif._id ? { ...n, isRead: true } : n))
      setUnread(Math.max(0, unread - 1))
    }
    setOpen(false)
    if (notif.link) router.push(notif.link)
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        >
          <Menu size={20} />
        </button>
        {title && <h1 className="text-base font-semibold text-slate-900 hidden sm:block">{title}</h1>}
      </div>

      <div className="flex items-center gap-3">
        {/* Availability toggle for psychologists */}
        {session?.user?.role === 'PSYCHOLOGIST' && (
          <AvailabilityToggle />
        )}

        {/* Notification bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen(!open)}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 rounded-full
                               text-white text-[10px] font-bold flex items-center justify-center min-w-[18px] min-h-[18px]">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="font-semibold text-sm text-slate-900">Notifications</div>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">No notifications yet</div>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
                                  ${!n.isRead ? 'bg-purple-50/50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && <div className="w-2 h-2 mt-1 rounded-full bg-purple-500 shrink-0" />}
                        <div className={!n.isRead ? '' : 'ml-4'}>
                          <div className="text-sm font-medium text-slate-900">{n.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>
                          <div className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
          {session?.user?.name?.[0]?.toUpperCase()}
        </div>
      </div>
    </header>
  )
}

function AvailabilityToggle() {
  const { data: session, update } = useSession()
  const [available, setAvailable] = useState(session?.user?.isAvailable ?? true)
  const [loading, setLoading]     = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !available
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: next }),
      })
      if (res.ok) {
        setAvailable(next)
        await update({ isAvailable: next })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
        ${available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
    >
      <div className={`w-2 h-2 rounded-full ${available ? 'bg-green-500' : 'bg-red-500'}`} />
      {available ? 'Available' : 'Unavailable'}
    </button>
  )
}
