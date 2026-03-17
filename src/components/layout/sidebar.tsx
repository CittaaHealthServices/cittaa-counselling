'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard, ClipboardList, Users, Eye, Calendar,
  BookOpen, FileText, School, UserCog, Bell, LogOut,
  ChevronLeft, ChevronRight, Brain, Activity, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href:   string
  label:  string
  icon:   React.ElementType
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',               label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/dashboard/requests',      label: 'Requests',     icon: ClipboardList },
  { href: '/dashboard/students',      label: 'Students',     icon: Users },
  { href: '/dashboard/observations',  label: 'Observations', icon: Eye },
  { href: '/dashboard/sessions',      label: 'Sessions',     icon: Calendar },
  { href: '/dashboard/workshops',     label: 'Workshops',    icon: BookOpen },
  { href: '/dashboard/assessments',   label: 'Assessments',  icon: Activity },
  { href: '/dashboard/rci',           label: 'RCI Reports',  icon: FileText,
    roles: ['CITTAA_ADMIN','CITTAA_SUPPORT','SCHOOL_PRINCIPAL','SCHOOL_ADMIN'] },
  { href: '/dashboard/schools',       label: 'Schools',      icon: School,
    roles: ['CITTAA_ADMIN','CITTAA_SUPPORT'] },
  { href: '/dashboard/users',         label: 'Users',        icon: UserCog,
    roles: ['CITTAA_ADMIN','CITTAA_SUPPORT','SCHOOL_PRINCIPAL','SCHOOL_ADMIN'] },
  { href: '/dashboard/notifications', label: 'Notifications',icon: Bell },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const pathname                    = usePathname()
  const { data: session }           = useSession()
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const role      = session?.user?.role ?? ''
  const userName  = session?.user?.name ?? ''
  const userEmail = session?.user?.email ?? ''

  const visible = NAV_ITEMS.filter(i => !i.roles || i.roles.includes(role))

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const close = () => { setMobileOpen(false); onClose?.() }

  const Inner = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-white/10',
        !mobile && collapsed && 'justify-center px-2')}>
        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <Brain size={18} className="text-purple-200" />
        </div>
        {(mobile || !collapsed) && (
          <div>
            <p className="text-white font-bold text-lg leading-none">Cittaa</p>
            <p className="text-purple-400 text-[10px] mt-0.5">MindBridge™ Platform</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {visible.map(item => {
          const Icon   = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} onClick={close}
              title={!mobile && collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active ? 'bg-purple-500/30 text-white border border-purple-400/40'
                       : 'text-purple-200/70 hover:text-white hover:bg-white/[0.08]',
                !mobile && collapsed && 'justify-center px-2'
              )}>
              <Icon size={18} className={cn('shrink-0', active && 'text-purple-300')} />
              {(mobile || !collapsed) && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {(mobile || !collapsed) && (
          <Link href="/dashboard/profile" onClick={close}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 mb-2 hover:bg-white/[0.08] transition">
            <div className="w-8 h-8 rounded-full bg-purple-500/40 border border-purple-400/40 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {userName.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white text-xs font-semibold truncate">{userName}</p>
              <p className="text-purple-400 text-[10px] truncate">{userEmail}</p>
            </div>
          </Link>
        )}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          title={!mobile && collapsed ? 'Sign out' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-purple-300/70 hover:text-red-300 hover:bg-red-500/10 text-sm transition',
            !mobile && collapsed && 'justify-center'
          )}>
          <LogOut size={16} className="shrink-0" />
          {(mobile || !collapsed) && <span>Sign out</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(v => !v)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-purple-900/90 border border-purple-700/50 text-white shadow">
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={close} />
      )}

      <aside className={cn(
        'lg:hidden fixed left-0 top-0 bottom-0 z-40 w-64 transition-transform duration-200',
        'bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-900 border-r border-white/10',
        mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <Inner mobile />
      </aside>

      <aside className={cn(
        'hidden lg:flex flex-col relative transition-all duration-200',
        'bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-900 border-r border-white/10',
        collapsed ? 'w-[60px]' : 'w-[220px]')}>
        <Inner />
        <button onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-700 border border-purple-500 flex items-center justify-center text-white shadow-md hover:bg-purple-600 transition z-10">
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>
    </>
  )
}

export default Sidebar
