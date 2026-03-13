import mongoose, { Schema, Document, Model } from 'mongoose'
import { AssessmentStatus, ASSESSMENT_TYPES } from '@/types'

export interface IAssessmentDoc extends Document {
  _id: mongoose.Types.ObjectId
  requestId: mongoose.Types.ObjectId
  sessionId?: mongoose.Types.ObjectId
  type: string
  reason: string                           // Why psychologist recommends assessment
  status: AssessmentStatus
  requestedById: mongoose.Types.ObjectId   // Psychologist
  approvedById?: mongoose.Types.ObjectId   // School principal / Cittaa admin
  approvalNote?: string
  rejectionReason?: string
  scheduledDate?: Date
  completedDate?: Date
  findings?: string                        // Post-assessment findings
  createdAt: Date
  updatedAt: Date
}

const AssessmentSchema = new Schema<IAssessmentDoc>(
  {
    requestId:     { type: Schema.Types.ObjectId, ref: 'CounselingRequest', required: true },
    sessionId:     { type: Schema.Types.ObjectId, ref: 'Session' },
    type:          { type: String, required: true, enum: ASSESSMENT_TYPES },
    reason:        { type: String, required: true },
    status:        {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'PENDING_APPROVAL',
    },
    requestedById:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedById:    { type: Schema.Types.ObjectId, ref: 'User' },
    approvalNote:    { type: String },
    rejectionReason: { type: String },
    scheduledDate:   { type: Date },
    completedDate:   { type: Date },
    findings:        { type: String },
  },
  { timestamps: true }
)

// Performance indexes
AssessmentSchema.index({ requestId: 1 })
AssessmentSchema.index({ requestedById: 1, status: 1 })          // psychologist's assessments
AssessmentSchema.index({ status: 1, createdAt: -1 })              // admin list view

const Assessment: Model<IAssessmentDoc> =
  mongoose.models.Assessment || mongoose.model<IAssessmentDoc>('Assessment', AssessmentSchema)

export default Assessment
