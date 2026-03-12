import mongoose, { Schema, Document, Model } from 'mongoose'
import { SessionStatus } from '@/types'

export interface ISessionDoc extends Document {
  _id: mongoose.Types.ObjectId
  requestId: mongoose.Types.ObjectId
  psychologistId: mongoose.Types.ObjectId
  substituteId?: mongoose.Types.ObjectId  // Assigned when original psychologist is unavailable
  substituteReason?: string
  scheduledAt: Date
  durationMinutes?: number
  status: SessionStatus
  notes?: string                           // Pre-session notes
  sessionReport?: string                   // Post-session observations (psychologist)
  followUpRequired: boolean
  nextSessionDate?: Date
  createdAt: Date
  updatedAt: Date
}

const SessionSchema = new Schema<ISessionDoc>(
  {
    requestId:       { type: Schema.Types.ObjectId, ref: 'CounselingRequest', required: true },
    psychologistId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    substituteId:    { type: Schema.Types.ObjectId, ref: 'User' },
    substituteReason:{ type: String },
    scheduledAt:     { type: Date, required: true },
    durationMinutes: { type: Number, default: 45 },
    status:          {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'],
      default: 'SCHEDULED',
    },
    notes:           { type: String },
    sessionReport:   { type: String },
    followUpRequired:{ type: Boolean, default: false },
    nextSessionDate: { type: Date },
  },
  { timestamps: true }
)

SessionSchema.index({ psychologistId: 1, scheduledAt: 1 })
SessionSchema.index({ requestId: 1 })

const Session: Model<ISessionDoc> =
  mongoose.models.Session || mongoose.model<ISessionDoc>('Session', SessionSchema)

export default Session
