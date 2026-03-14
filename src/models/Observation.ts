import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Classroom Observation
 * ─────────────────────
 * Flow:
 *   Psychologist visits class → records observations for a student
 *   → sends to class teacher / coordinator → they review & either:
 *     a) Approve → auto-creates a CounselingRequest (PENDING_APPROVAL)
 *     b) Acknowledge only (no escalation needed)
 *     c) Add a comment / clarification
 */

export type ObservationStatus =
  | 'DRAFT'                // Psychologist saving notes, not yet shared
  | 'SHARED'               // Sent to teacher/coordinator, awaiting review
  | 'ACKNOWLEDGED'         // Teacher reviewed, no escalation needed
  | 'ESCALATED'            // Teacher approved → CounselingRequest created
  | 'DECLINED'             // Teacher declined escalation with reason

export interface IObservationDoc extends Document {
  _id: mongoose.Types.ObjectId
  studentId:       mongoose.Types.ObjectId
  schoolId:        mongoose.Types.ObjectId
  psychologistId:  mongoose.Types.ObjectId       // who observed

  // Observation details
  classVisitDate:  Date
  classObserved:   string                         // e.g. "Class 8-A Math period"
  observations:    string                         // Detailed notes from the classroom
  behaviourFlags:  string[]                       // quick tags: ['withdrawn', 'aggressive', 'inattentive', ...]
  recommendEscalation: boolean                    // psychologist recommends formal counselling

  // Routing
  sharedWithId?:   mongoose.Types.ObjectId        // teacher/coordinator it was shared with
  sharedAt?:       Date

  // Teacher / coordinator response
  status:          ObservationStatus
  reviewedById?:   mongoose.Types.ObjectId
  reviewNote?:     string                         // Teacher's comment
  reviewedAt?:     Date

  // If escalated — link to the created request
  counsellingRequestId?: mongoose.Types.ObjectId

  createdAt: Date
  updatedAt: Date
}

const ObservationSchema = new Schema<IObservationDoc>(
  {
    studentId:       { type: Schema.Types.ObjectId, ref: 'Student',            required: true },
    schoolId:        { type: Schema.Types.ObjectId, ref: 'School',             required: true },
    psychologistId:  { type: Schema.Types.ObjectId, ref: 'User',               required: true },

    classVisitDate:  { type: Date, required: true, default: Date.now },
    classObserved:   { type: String, required: true },
    observations:    { type: String, required: true },
    behaviourFlags:  [{ type: String }],
    recommendEscalation: { type: Boolean, default: false },

    sharedWithId:    { type: Schema.Types.ObjectId, ref: 'User' },
    sharedAt:        { type: Date },

    status:          {
      type: String,
      enum: ['DRAFT', 'SHARED', 'ACKNOWLEDGED', 'ESCALATED', 'DECLINED'],
      default: 'DRAFT',
    },
    reviewedById:    { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote:      { type: String },
    reviewedAt:      { type: Date },

    counsellingRequestId: { type: Schema.Types.ObjectId, ref: 'CounselingRequest' },
  },
  { timestamps: true }
)

ObservationSchema.index({ schoolId: 1, status: 1, createdAt: -1 })
ObservationSchema.index({ psychologistId: 1, createdAt: -1 })
ObservationSchema.index({ sharedWithId: 1, status: 1 })
ObservationSchema.index({ studentId: 1 })
// Standalone createdAt index for fast date-range $facet sub-pipelines
// (today / thisWeek / thisMonth filters in the dashboard stats aggregation)
ObservationSchema.index({ createdAt: -1 })

const Observation: Model<IObservationDoc> =
  mongoose.models.Observation ||
  mongoose.model<IObservationDoc>('Observation', ObservationSchema)

export default Observation
