import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { RequestStatus, Priority } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Request number generator ─────────────────────────────────────────────────
export function generateRequestNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900000) + 100000
  return `REQ-${year}-${random}`
}

// ─── Status display helpers ───────────────────────────────────────────────────
export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING_APPROVAL:      'Pending Approval',
  APPROVED:              'Approved',
  REJECTED:              'Rejected',
  PSYCHOLOGIST_ASSIGNED: 'Psychologist Assigned',
  SESSION_SCHEDULED:     'Session Scheduled',
  SESSION_COMPLETED:     'Session Completed',
  ASSESSMENT_REQUESTED:  'Assessment Requested',
  ASSESSMENT_APPROVED:   'Assessment Approved',
  ASSESSMENT_REJECTED:   'Assessment Rejected',
  RCI_NOTIFIED:          'RCI Notified',
  RCI_VISITING:          'RCI Visiting',
  RCI_REPORT_SUBMITTED:  'Report Submitted',
  CLOSED:                'Closed',
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING_APPROVAL:      'bg-yellow-100 text-yellow-800',
  APPROVED:              'bg-blue-100 text-blue-800',
  REJECTED:              'bg-red-100 text-red-800',
  PSYCHOLOGIST_ASSIGNED: 'bg-indigo-100 text-indigo-800',
  SESSION_SCHEDULED:     'bg-purple-100 text-purple-800',
  SESSION_COMPLETED:     'bg-teal-100 text-teal-800',
  ASSESSMENT_REQUESTED:  'bg-orange-100 text-orange-800',
  ASSESSMENT_APPROVED:   'bg-cyan-100 text-cyan-800',
  ASSESSMENT_REJECTED:   'bg-red-100 text-red-800',
  RCI_NOTIFIED:          'bg-violet-100 text-violet-800',
  RCI_VISITING:          'bg-emerald-100 text-emerald-800',
  RCI_REPORT_SUBMITTED:  'bg-green-100 text-green-800',
  CLOSED:                'bg-gray-100 text-gray-700',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW:    'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export const PRIORITY_DOT: Record<Priority, string> = {
  LOW:    'bg-gray-400',
  MEDIUM: 'bg-blue-500',
  HIGH:   'bg-orange-500',
  URGENT: 'bg-red-600',
}

// ─── Timezone — all dates displayed in IST ────────────────────────────────────
export const IST_TZ = 'Asia/Kolkata'

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: IST_TZ,
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: IST_TZ,
    hour12: true,
  })
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
    timeZone: IST_TZ,
    hour12: true,
  })
}

export function toISTInputValue(date?: Date): string {
  const d = date ? new Date(date) : new Date()
  // Returns "YYYY-MM-DDTHH:MM" formatted in IST for datetime-local inputs
  const ist = new Date(d.toLocaleString('en-US', { timeZone: IST_TZ }))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${ist.getFullYear()}-${pad(ist.getMonth()+1)}-${pad(ist.getDate())}T${pad(ist.getHours())}:${pad(ist.getMinutes())}`
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60)   return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  CITTAA_ADMIN:     'Cittaa Admin',
  CITTAA_SUPPORT:   'Cittaa Support',
  SCHOOL_PRINCIPAL: 'Principal',
  SCHOOL_ADMIN:     'School Admin',
  COORDINATOR:      'Coordinator',
  CLASS_TEACHER:    'Class Teacher',
  PSYCHOLOGIST:     'Psychologist',
  RCI_TEAM:         'RCI Team',
}

export function canSubmitRequest(role: string): boolean {
  return ['COORDINATOR', 'CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(role)
}

export function canApproveRequest(role: string): boolean {
  return ['SCHOOL_PRINCIPAL', 'CITTAA_ADMIN'].includes(role)
}

export function canAssignPsychologist(role: string): boolean {
  return ['CITTAA_ADMIN'].includes(role)
}

export function canRequestAssessment(role: string): boolean {
  return ['PSYCHOLOGIST'].includes(role)
}

export function canApproveAssessment(role: string): boolean {
  return ['SCHOOL_PRINCIPAL', 'CITTAA_ADMIN'].includes(role)
}

export function isSchoolUser(role: string): boolean {
  return ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'COORDINATOR', 'CLASS_TEACHER'].includes(role)
}

export function canManageSchoolUsers(role: string): boolean {
  return ['SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN', 'CITTAA_ADMIN'].includes(role)
}
