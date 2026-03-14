'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Eye,
  Calendar,
  BookOpen,
  FileText,
  School,
  UserCog,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Brain,
  Activity,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href:   string
  label:  string
  icon:   React.ElementType
  roles?: string[]
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',              label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/dashboard/requests',     label: 'Requests',           icon: ClipboardList },
  { href: '/dashboard/students',     label: 'Students',           icon: Users },
  { href: '/dashboard/observations', label: 'Observations',       icon: Eye },
  { href: '/dashboard/sessions',     label: 'Sessions',           icon: Calendar },
  { href: '/dashboard/workshops',    label: 'Workshops',          icon: BookOpen },
  { href: '/dashboard/assessments',  label: 'Assessments',        icon: Activity },
  { href: '/dashboard/rci',          label: 'RCI Reports',        icon: FileText,
    roles: ['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'] },
  { href: '/dashboard/schools',      label: 'Schools',            icon: School,
    roles: ['CITTAA_ADMIN', 'CITTAA_SUPPORT'] },
  { href: '/dashboard/users',        label: 'Users',              icon: UserCog,
    roles: ['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'] },
  { href: '/dashboard/notifications', label: 'Notifications',     icon: Bell },
]

export default function Sidebar() {
  const pathname                = usePathname()
  const { data: session }       = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const role      = session?.user?.role ?? ''
  const userName  = session?.user?.name ?? ''
  const userEmail = session?.user?.email ?? ''

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(role)
  )

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-white/10',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <Brain size={18} className="text-purple-200" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p
              className="text-white font-bold text-lg leading-none"
              style={{ fontFamily: "'Kaushan Script', cursive" }}
            >
              Cittaa
            </p>
            <p className="text-purple-400 text-[10px] mt-0.5 truncate">MindBridge™ Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {visibleItems.map(item => {
          const Icon   = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-purple-500/30 text-white border border-purple-400/40'
                  : 'text-purple-200/70 hover:text-white hover:bg-white/8',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className={cn('shrink-0', active && 'text-purple-300')} />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
              {!collapsed && item.badge != null && item.badge > 0 && (
                <span className="ml-auto shrink-0 rounded-full bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + sign-out */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 mb-2 hover:bg-white/8 transition"
          >
            <div className="w-8 h-8 rounded-full bg-purple-500/40 border border-purple-400/40 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {userName.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold truncate">{userName}</p>
              <p className="text-purple-400 text-[10px] truncate">{userEmail}</p>
            </div>
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-purple-300/70 hover:text-red-300 hover:bg-red-500/10 text-sm transition',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* Collapse toggle (desktop) */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-700 border border-purple-500 items-center justify-center text-white shadow-md hover:bg-purple-600 transition"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(v => !v)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-purple-900/90 border border-purple-700/50 text-white shadow"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        'lg:hidden fixed left-0 top-0 bottom-0 z-40 w-64 bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-900 border-r border-white/10 transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-900 border-r border-white/10 transition-all duration-200 relative',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}>
        <SidebarContent />
      </aside>
    </>
  )
}
