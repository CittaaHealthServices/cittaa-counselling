import mongoose, { Document, Schema } from 'mongoose'

export interface IObservation extends Document {
  studentId:           mongoose.Types.ObjectId
  schoolId:            mongoose.Types.ObjectId
  conductedById:       mongoose.Types.ObjectId
  classObserved:       string
  visitDate:           Date
  behaviourFlags:      string[]
  observationNotes:    string
  recommendations:     string
  sharedWith:          mongoose.Types.ObjectId[]
  sharedWithEmails:    string[]
  recommendEscalation: boolean
  status:              'DRAFT' | 'AWAITING_REVIEW' | 'ACKNOWLEDGED' | 'ESCALATED' | 'DECLINED'
  teacherResponse:     string
  declineReason:       string
  escalatedRequestId?: mongoose.Types.ObjectId
  isConfidential:      boolean
  createdAt:           Date
  updatedAt:           Date
}

const ObservationSchema = new Schema<IObservation>(
  {
    studentId:        { type: Schema.Types.ObjectId, ref: 'Student' },
    schoolId:         { type: Schema.Types.ObjectId, ref: 'School'  },
    conductedById:    { type: Schema.Types.ObjectId, ref: 'User'    },
    classObserved:    { type: String, default: '', trim: true },
    visitDate:        { type: Date },
    behaviourFlags:   { type: [String], default: [] },
    observationNotes: { type: String, default: '' },
    recommendations:  { type: String, default: '' },
    sharedWith:       [{ type: Schema.Types.ObjectId, ref: 'User' }],
    sharedWithEmails: { type: [String], default: [] },
    recommendEscalation: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['DRAFT','AWAITING_REVIEW','ACKNOWLEDGED','ESCALATED','DECLINED'],
      default: 'DRAFT',
    },
    teacherResponse:    { type: String, default: '' },
    declineReason:      { type: String, default: '' },
    escalatedRequestId: { type: Schema.Types.ObjectId, ref: 'CounselingRequest' },
    isConfidential:     { type: Boolean, default: false },
  },
  { timestamps: true }
)

ObservationSchema.index({ schoolId: 1, status: 1 })
ObservationSchema.index({ conductedById: 1, status: 1 })
ObservationSchema.index({ studentId: 1 })
ObservationSchema.index({ createdAt: -1 })

export default mongoose.models.Observation as mongoose.Model<IObservation>
  || mongoose.model<IObservation>('Observation', ObservationSchema)
