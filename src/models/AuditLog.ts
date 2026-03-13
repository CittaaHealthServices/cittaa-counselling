import mongoose, { Schema, Document, Model } from 'mongoose'
import { Role } from '@/types'

/**
 * AuditLog — Immutable record of every write action performed by any user.
 *
 * Serves as a tamper-evident activity trail for:
 * – Regulatory compliance / safeguarding requirements
 * – Dispute resolution (who approved what, when)
 * – Security incident investigation
 *
 * Records are NEVER deleted or updated. Soft-delete is not supported here.
 */

export type AuditAction =
  // Auth
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_RESET'
  // Requests
  | 'REQUEST_CREATED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_EDITED'
  | 'REQUEST_CLOSED'
  | 'PSYCHOLOGIST_ASSIGNED'
  // Sessions
  | 'SESSION_SCHEDULED'
  | 'SESSION_COMPLETED'
  | 'SESSION_CANCELLED'
  | 'SESSION_UPDATED'
  // Observations
  | 'OBSERVATION_CREATED'
  | 'OBSERVATION_SHARED'
  | 'OBSERVATION_ACKNOWLEDGED'
  | 'OBSERVATION_ESCALATED'
  | 'OBSERVATION_DECLINED'
  | 'OBSERVATION_UPDATED'
  // Assessments
  | 'ASSESSMENT_REQUESTED'
  | 'ASSESSMENT_APPROVED'
  | 'ASSESSMENT_REJECTED'
  | 'ASSESSMENT_UPDATED'
  | 'RCI_ASSIGNED'
  // RCI
  | 'RCI_STATUS_UPDATED'
  | 'RCI_REPORT_SUBMITTED'
  // Users / Schools / Students
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'SCHOOL_CREATED'
  | 'SCHOOL_UPDATED'
  | 'STUDENT_CREATED'
  | 'STUDENT_UPDATED'
  | 'STUDENTS_BULK_UPLOADED'

export interface IAuditLogDoc extends Document {
  _id: mongoose.Types.ObjectId
  // Who
  userId:     mongoose.Types.ObjectId
  userEmail:  string
  userRole:   Role
  // What
  action:     AuditAction
  resource:   string          // e.g. 'CounselingRequest', 'Session', 'User'
  resourceId: string          // _id of the affected document
  // Context
  schoolId?:  string          // School context if applicable
  details?:   Record<string, any>  // e.g. { previousStatus, newStatus, note }
  // Where
  ipAddress?: string
  userAgent?: string
  // When
  createdAt:  Date
}

const AuditLogSchema = new Schema<IAuditLogDoc>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail:  { type: String, required: true },
    userRole:   { type: String, required: true },
    action:     { type: String, required: true },
    resource:   { type: String, required: true },
    resourceId: { type: String, required: true },
    schoolId:   { type: String },
    details:    { type: Schema.Types.Mixed },
    ipAddress:  { type: String },
    userAgent:  { type: String },
  },
  {
    // Only createdAt, no updatedAt — logs are immutable
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Indexes for fast audit queries
AuditLogSchema.index({ userId: 1,     createdAt: -1 })
AuditLogSchema.index({ resourceId: 1, createdAt: -1 })
AuditLogSchema.index({ action: 1,     createdAt: -1 })
AuditLogSchema.index({ schoolId: 1,   createdAt: -1 })
AuditLogSchema.index({ createdAt: -1 })

// Prevent updates and deletes at the Mongoose level
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog records are immutable')
})
AuditLogSchema.pre('updateOne', function () {
  throw new Error('AuditLog records are immutable')
})
AuditLogSchema.pre('deleteOne', function () {
  throw new Error('AuditLog records are immutable')
})
AuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('AuditLog records are immutable')
})

const AuditLog: Model<IAuditLogDoc> =
  mongoose.models.AuditLog || mongoose.model<IAuditLogDoc>('AuditLog', AuditLogSchema)

export default AuditLog
