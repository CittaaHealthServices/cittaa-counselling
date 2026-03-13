'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Brain, LayoutDashboard, FileText, Calendar, ClipboardList,
  Map, School, Users, UserCog, LogOut, X, Settings, BookOpen, Eye, Bell,
  type LucideIcon,
} from 'lucide-react'
import { cn, ROLE_LABELS } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',               label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/dashboard/requests',      label: 'Requests',       icon: FileText,
    roles: ['PSYCHOLOGIST', 'SCHOOL_PRINCIPAL', 'COORDINATOR', 'CLASS_TEACHER',
            'CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_ADMIN'] },
  { href: '/dashboard/observations',  label: 'Observations',   icon: Eye,
    roles: ['PSYCHOLOGIST', 'SCHOOL_PRINCIPAL', 'COORDINATOR', 'CLASS_TEACHER',
            'CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_ADMIN'] },
  { href: '/dashboard/sessions',      label: 'Sessions',       icon: Calendar,
    roles: ['PSYCHOLOGIST', 'SCHOOL_PRINCIPAL', 'CITTAA_ADMIN', 'CITTAA_SUPPORT',
            'SCHOOL_ADMIN', 'COORDINATOR', 'CLASS_TEACHER'] },
  { href: '/dashboard/assessments',   label: 'Assessments',    icon: ClipboardList,
    roles: ['PSYCHOLOGIST', 'SCHOOL_PRINCIPAL', 'CITTAA_ADMIN', 'CITTAA_SUPPORT',
            'RCI_TEAM', 'SCHOOL_ADMIN'] },
  { href: '/dashboard/rci',           label: 'RCI Reports',    icon: Map,
    roles: ['RCI_TEAM', 'CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL'] },
  { href: '/dashboard/students',      label: 'Students',       icon: BookOpen,
    roles: ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'COORDINATOR', 'CLASS_TEACHER',
            'CITTAA_ADMIN', 'CITTAA_SUPPORT', 'PSYCHOLOGIST'] },
  { href: '/dashboard/schools',       label: 'Schools',        icon: School,
    roles: ['CITTAA_ADMIN', 'CITTAA_SUPPORT'] },
  { href: '/dashboard/users',         label: 'Users',          icon: Users,
    roles: ['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'] },
  { href: '/dashboard/notifications',  label: 'Notifications',  icon: Bell },
  { href: '/dashboard/profile',        label: 'Profile',        icon: UserCog },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role || ''

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="w-60 flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Brain size={18} className="text-white" />
          </div>
          <div>
            <div className="cittaa-brand text-slate-900 text-base leading-none">Cittaa</div>
            <div className="text-xs text-slate-400">Mind Bridge</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* School badge */}
      {session?.user?.schoolName && (
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="bg-blue-50 rounded-lg px-3 py-2">
            <div className="text-xs text-blue-500 font-medium">School</div>
            <div className="text-sm font-semibold text-blue-800 truncate">{session.user.schoolName}</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn('sidebar-item', isActive && 'active')}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
            {session?.user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{session?.user?.name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABELS[role] || role}</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500
                     hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
