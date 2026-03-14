import mongoose, { Schema, Document, Model } from 'mongoose'

export type WorkshopProgramType =
  | 'CLASSROOM_WORKSHOP'
  | 'GROUP_COUNSELLING'
  | 'TEACHER_TRAINING'
  | 'PEER_PROGRAM'
  | 'PARENT_WORKSHOP'
  | 'ORIENTATION'

export type WorkshopStatus =
  | 'PLANNED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'POSTPONED'

export type WorkshopMode = 'ONLINE' | 'OFFLINE' | 'HYBRID'
export type WorkshopSeriesType = 'ONE_TIME' | 'MONTHLY_SERIES' | 'BI_WEEKLY' | 'QUARTERLY'
export type WorkshopMaterialStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY'
export type WorkshopPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface IWorkshopDoc extends Document {
  _id: mongoose.Types.ObjectId

  // Core
  title: string
  schoolId: mongoose.Types.ObjectId
  academicYear: string            // '2026-27'

  // Classification
  programType: WorkshopProgramType
  theme: string                   // 'SEL', 'Academic Stress', 'Cyber Safety', etc.
  targetGroup: string             // 'Grade 9–12', 'All Parents', 'All Staff'
  gradeRange?: string             // e.g. 'Grade 6–8'

  // Schedule
  plannedDate?: Date
  actualDate?: Date
  month?: string                  // 'Mar 2026'
  week?: number                   // 1–4
  mode: WorkshopMode
  durationMinutes: number
  seriesType: WorkshopSeriesType

  // Priority & Status
  priority: WorkshopPriority
  status: WorkshopStatus

  // Facilitation
  conductedById?: mongoose.Types.ObjectId    // psychologist who ran it
  materialPreparedBy?: string               // internal CITTAA team member name
  materialStatus: WorkshopMaterialStatus

  // Attendance
  plannedAttendance?: number
  actualAttendance?: number

  // Outcomes
  feedbackScore?: number          // 1–5
  keyObservations?: string
  followUpRequired?: boolean
  followUpNotes?: string

  // Meta
  comments?: string
  isFromTemplate: boolean         // created from MindBridge template bank

  createdAt: Date
  updatedAt: Date
}

const WorkshopSchema = new Schema<IWorkshopDoc>(
  {
    title:        { type: String, required: true },
    schoolId:     { type: Schema.Types.ObjectId, ref: 'School', required: true },
    academicYear: { type: String, default: '2026-27' },

    programType:  {
      type: String,
      enum: ['CLASSROOM_WORKSHOP', 'GROUP_COUNSELLING', 'TEACHER_TRAINING',
             'PEER_PROGRAM', 'PARENT_WORKSHOP', 'ORIENTATION'],
      required: true,
    },
    theme:       { type: String, required: true },
    targetGroup: { type: String, required: true },
    gradeRange:  { type: String },

    plannedDate: { type: Date },
    actualDate:  { type: Date },
    month:       { type: String },
    week:        { type: Number, min: 1, max: 4 },
    mode:        { type: String, enum: ['ONLINE', 'OFFLINE', 'HYBRID'], default: 'OFFLINE' },
    durationMinutes: { type: Number, default: 45 },
    seriesType:  {
      type: String,
      enum: ['ONE_TIME', 'MONTHLY_SERIES', 'BI_WEEKLY', 'QUARTERLY'],
      default: 'ONE_TIME',
    },

    priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
    status:   {
      type: String,
      enum: ['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'POSTPONED'],
      default: 'PLANNED',
    },

    conductedById:      { type: Schema.Types.ObjectId, ref: 'User' },
    materialPreparedBy: { type: String },
    materialStatus:     {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'READY'],
      default: 'NOT_STARTED',
    },

    plannedAttendance: { type: Number },
    actualAttendance:  { type: Number },

    feedbackScore:    { type: Number, min: 1, max: 5 },
    keyObservations:  { type: String },
    followUpRequired: { type: Boolean, default: false },
    followUpNotes:    { type: String },

    comments:       { type: String },
    isFromTemplate: { type: Boolean, default: false },
  },
  { timestamps: true }
)

WorkshopSchema.index({ schoolId: 1, status: 1, plannedDate: -1 })
WorkshopSchema.index({ schoolId: 1, programType: 1 })
WorkshopSchema.index({ conductedById: 1, plannedDate: -1 })
WorkshopSchema.index({ plannedDate: -1 })
WorkshopSchema.index({ theme: 1 })

const Workshop: Model<IWorkshopDoc> =
  mongoose.models.Workshop ||
  mongoose.model<IWorkshopDoc>('Workshop', WorkshopSchema)

export default Workshop
