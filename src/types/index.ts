// ─── Roles ───────────────────────────────────────────────────────────────────
export type Role =
  | 'CITTAA_ADMIN'       // Cittaa super-admin (full visibility across all schools)
  | 'CITTAA_SUPPORT'     // Cittaa IT/support staff (read-only global access)
  | 'SCHOOL_PRINCIPAL'   // Principal – school-level approval authority
  | 'SCHOOL_ADMIN'       // School admin (IT coordinator, office admin) – manages users/students but no approvals
  | 'COORDINATOR'        // School coordinator – can submit requests, view their class
  | 'CLASS_TEACHER'      // Class teacher – can submit requests for their students
  | 'PSYCHOLOGIST'       // Psychologist – manages sessions, requests assessments
  | 'RCI_TEAM'           // RCI field team – receives assignments, submits reports

// ─── Request Status (full lifecycle) ─────────────────────────────────────────
export type RequestStatus =
  | 'PENDING_APPROVAL'         // Submitted by teacher/coordinator, awaiting principal
  | 'APPROVED'                 // Principal approved – awaiting psychologist assignment
  | 'REJECTED'                 // Rejected by principal
  | 'PSYCHOLOGIST_ASSIGNED'    // Psychologist assigned, session pending scheduling
  | 'SESSION_SCHEDULED'        // Session date/time confirmed
  | 'SESSION_COMPLETED'        // Session done by psychologist
  | 'ASSESSMENT_REQUESTED'     // Psychologist requested formal assessment
  | 'ASSESSMENT_APPROVED'      // School management approved assessment
  | 'ASSESSMENT_REJECTED'      // School management rejected assessment request
  | 'RCI_NOTIFIED'             // RCI team has been notified
  | 'RCI_VISITING'             // RCI visit scheduled/in-progress
  | 'RCI_REPORT_SUBMITTED'     // RCI submitted findings report
  | 'CLOSED'                   // Case fully closed

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'

export type AssessmentStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'

export type RCIStatus =
  | 'NOTIFIED'
  | 'VISIT_SCHEDULED'
  | 'VISITING'
  | 'REPORT_SUBMITTED'

// ─── Notification Types ───────────────────────────────────────────────────────
export type NotificationType =
  | 'NEW_REQUEST'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'PSYCHOLOGIST_ASSIGNED'
  | 'SESSION_SCHEDULED'
  | 'SESSION_REMINDER'
  | 'ASSESSMENT_REQUESTED'
  | 'ASSESSMENT_APPROVED'
  | 'ASSESSMENT_REJECTED'
  | 'RCI_ASSIGNED'
  | 'RCI_REPORT_READY'
  | 'SUBSTITUTE_ASSIGNED'
  | 'GENERAL'

// ─── Concern Categories ───────────────────────────────────────────────────────
export const CONCERN_CATEGORIES = [
  'Academic Stress',
  'Behavioural Issues',
  'Anxiety / Panic',
  'Depression / Mood',
  'Bullying (Victim)',
  'Bullying (Perpetrator)',
  'Family Issues',
  'Peer Relationship',
  'Substance Use Concern',
  'Self-Harm Concern',
  'Grief / Loss',
  'Learning Difficulties',
  'Attention / ADHD',
  'Other',
] as const

export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number]

// ─── Session interfaces (for API responses) ───────────────────────────────────
export interface IUser {
  _id: string
  name: string
  email: string
  role: Role
  phone?: string
  schoolId?: string | ISchool
  isActive: boolean
  isAvailable: boolean
  createdAt: string
}

export interface ISchool {
  _id: string
  name: string
  code?: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  principalName?: string
  principalEmail?: string
  principalPhone?: string
  totalStudents?: number
  isActive: boolean
}

export interface IStudent {
  _id: string
  name: string
  rollNumber?: string
  class: string
  section?: string
  age?: number
  gender?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  schoolId: string | ISchool
  isActive?: boolean
}

export interface IRequest {
  _id: string
  requestNumber: string
  student: IStudent
  school: ISchool
  submittedBy: IUser
  concernCategory: ConcernCategory
  description: string
  priority: Priority
  status: RequestStatus
  isConfidential: boolean
  assignedPsychologist?: IUser
  statusHistory: IStatusHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface IStatusHistoryEntry {
  status: RequestStatus
  changedBy: IUser
  note?: string
  timestamp: string
}

export interface ISession {
  _id: string
  requestId: string | IRequest
  psychologist: IUser
  substitute?: IUser
  scheduledAt: string
  durationMinutes?: number
  status: SessionStatus
  notes?: string
  sessionReport?: string
  followUpRequired: boolean
  createdAt: string
}

export interface IAssessment {
  _id: string
  requestId: string | IRequest
  sessionId?: string | ISession
  type: string
  reason: string
  status: AssessmentStatus
  requestedBy: IUser
  approvedBy?: IUser
  rciReport?: IRCIReport
  createdAt: string
}

export interface IRCIReport {
  _id: string
  assessmentId: string | IAssessment
  assignedTo: IUser
  visitDate?: string
  findings?: string
  recommendations?: string
  reportFileUrl?: string
  status: RCIStatus
  createdAt: string
}

export interface INotification {
  _id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  link?: string
  createdAt: string
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
  totalRequests: number
  pendingApproval: number
  activeSessions: number
  assessmentsPending: number
  rciPending: number
  closedThisMonth: number
  urgentCases: number
  requestsByStatus: Record<string, number>
  requestsByPriority: Record<string, number>
  monthlyTrend: { month: string; count: number }[]
}
