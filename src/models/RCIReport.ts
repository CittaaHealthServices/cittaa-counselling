import mongoose, { Schema, Document, Model } from 'mongoose'
import { RCIStatus } from '@/types'

export interface IRCIReportDoc extends Document {
  _id: mongoose.Types.ObjectId
  assessmentId: mongoose.Types.ObjectId
  requestId: mongoose.Types.ObjectId    // Denormalised for easier querying
  schoolId: mongoose.Types.ObjectId
  assignedToId: mongoose.Types.ObjectId // RCI team member assigned
  assignedById: mongoose.Types.ObjectId // Cittaa admin who assigned
  visitDate?: Date
  findings?: string
  recommendations?: string
  reportUrl?: string          // Link to uploaded/shared report document
  internalNotes?: string      // Internal Cittaa admin notes (not visible to school)
  status: RCIStatus
  notifiedAt?: Date
  reportSubmittedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const RCIReportSchema = new Schema<IRCIReportDoc>(
  {
    assessmentId:      { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    requestId:         { type: Schema.Types.ObjectId, ref: 'CounselingRequest', required: true },
    schoolId:          { type: Schema.Types.ObjectId, ref: 'School', required: true },
    assignedToId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedById:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visitDate:         { type: Date },
    findings:          { type: String },
    recommendations:   { type: String },
    reportUrl:         { type: String },
    internalNotes:     { type: String },
    status:            {
      type: String,
      enum: ['NOTIFIED', 'VISIT_SCHEDULED', 'VISITING', 'REPORT_SUBMITTED'],
      default: 'NOTIFIED',
    },
    notifiedAt:         { type: Date, default: Date.now },
    reportSubmittedAt:  { type: Date },
  },
  { timestamps: true }
)

const RCIReport: Model<IRCIReportDoc> =
  mongoose.models.RCIReport || mongoose.model<IRCIReportDoc>('RCIReport', RCIReportSchema)

export default RCIReport
