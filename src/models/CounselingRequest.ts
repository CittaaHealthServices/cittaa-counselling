import mongoose, { Schema, Document, Model } from 'mongoose'
import { RequestStatus, Priority, ConcernCategory } from '@/types'

export interface IStatusHistoryEntry {
  status: RequestStatus
  changedBy: mongoose.Types.ObjectId
  note?: string
  timestamp: Date
}

export interface ICounselingRequestDoc extends Document {
  _id: mongoose.Types.ObjectId
  requestNumber: string
  studentId: mongoose.Types.ObjectId
  schoolId: mongoose.Types.ObjectId
  submittedById: mongoose.Types.ObjectId
  concernCategory: ConcernCategory
  description: string
  priority: Priority
  status: RequestStatus
  isConfidential: boolean             // Hide teacher identity from student/parents
  assignedPsychologistId?: mongoose.Types.ObjectId
  substitutePsychologistId?: mongoose.Types.ObjectId
  approvedById?: mongoose.Types.ObjectId
  rejectionReason?: string
  statusHistory: IStatusHistoryEntry[]
  createdAt: Date
  updatedAt: Date
}

const StatusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    status:    { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note:      { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
)

const CounselingRequestSchema = new Schema<ICounselingRequestDoc>(
  {
    requestNumber: {
      type: String, required: true, unique: true,
    },
    studentId:    { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    schoolId:     { type: Schema.Types.ObjectId, ref: 'School',  required: true },
    submittedById:{ type: Schema.Types.ObjectId, ref: 'User',    required: true },
    concernCategory: {
      type: String,
      enum: [
        'Academic Stress', 'Behavioural Issues', 'Anxiety / Panic', 'Depression / Mood',
        'Bullying (Victim)', 'Bullying (Perpetrator)', 'Family Issues', 'Peer Relationship',
        'Substance Use Concern', 'Self-Harm Concern', 'Grief / Loss',
        'Learning Difficulties', 'Attention / ADHD', 'Other',
      ],
      required: true,
    },
    description:  { type: String, required: true },
    priority:     { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status:       {
      type: String,
      enum: [
        'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
        'PSYCHOLOGIST_ASSIGNED', 'SESSION_SCHEDULED', 'SESSION_COMPLETED',
        'ASSESSMENT_REQUESTED', 'ASSESSMENT_APPROVED', 'ASSESSMENT_REJECTED',
        'RCI_NOTIFIED', 'RCI_VISITING', 'RCI_REPORT_SUBMITTED', 'CLOSED',
      ],
      default: 'PENDING_APPROVAL',
    },
    isConfidential:           { type: Boolean, default: false },
    assignedPsychologistId:   { type: Schema.Types.ObjectId, ref: 'User' },
    substitutePsychologistId: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedById:             { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason:          { type: String },
    statusHistory:            [StatusHistorySchema],
  },
  { timestamps: true }
)

// Indexes for efficient queries
CounselingRequestSchema.index({ schoolId: 1, status: 1 })
CounselingRequestSchema.index({ assignedPsychologistId: 1, status: 1 })
CounselingRequestSchema.index({ studentId: 1 })
CounselingRequestSchema.index({ createdAt: -1 })

const CounselingRequest: Model<ICounselingRequestDoc> =
  mongoose.models.CounselingRequest ||
  mongoose.model<ICounselingRequestDoc>('CounselingRequest', CounselingRequestSchema)

export default CounselingRequest
