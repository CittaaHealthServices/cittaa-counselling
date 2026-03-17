import mongoose, { Document, Schema } from 'mongoose'

export interface IWorkshop extends Document {
  title:               string
  schoolId:            mongoose.Types.ObjectId
  academicYear:        string
  programType:         string
  theme:               string
  targetGroup:         string
  gradeRange:          string
  plannedDate?:        Date
  actualDate?:         Date
  month:               string
  week:                string
  mode:                string
  durationMinutes:     number
  seriesType:          string
  priority:            string
  status:              string
  conductedById?:      mongoose.Types.ObjectId
  materialPreparedBy:  string
  materialStatus:      string
  plannedAttendance:   number
  actualAttendance:    number
  feedbackScore:       number
  keyObservations:     string
  followUpRequired:    boolean
  followUpNotes:       string
  comments:            string
  isFromTemplate:      boolean
  createdAt:           Date
  updatedAt:           Date
}

const WorkshopSchema = new Schema<IWorkshop>(
  {
    title:             { type: String, required: true, trim: true },
    schoolId:          { type: Schema.Types.ObjectId, ref: 'School', required: true },
    academicYear:      { type: String, default: '2026-27' },
    programType:       { type: String, required: true,
      enum: ['CLASSROOM_WORKSHOP','GROUP_COUNSELLING','TEACHER_TRAINING','PEER_PROGRAM','PARENT_WORKSHOP','ORIENTATION'] },
    theme:             { type: String, required: true },
    targetGroup:       { type: String, required: true },
    gradeRange:        { type: String, default: '' },
    plannedDate:       { type: Date },
    actualDate:        { type: Date },
    month:             { type: String, default: '' },
    week:              { type: String, default: '' },
    mode:              { type: String, enum: ['OFFLINE','ONLINE','HYBRID'], default: 'OFFLINE' },
    durationMinutes:   { type: Number, default: 45 },
    seriesType:        { type: String, enum: ['ONE_TIME','SERIES','RECURRING'], default: 'ONE_TIME' },
    priority:          { type: String, enum: ['LOW','MEDIUM','HIGH'], default: 'MEDIUM' },
    status:            { type: String,
      enum: ['PLANNED','CONFIRMED','COMPLETED','CANCELLED','POSTPONED'], default: 'PLANNED' },
    conductedById:     { type: Schema.Types.ObjectId, ref: 'User' },
    materialPreparedBy:{ type: String, default: '' },
    materialStatus:    { type: String, enum: ['NOT_STARTED','IN_PROGRESS','READY','NEEDS_REVIEW'], default: 'NOT_STARTED' },
    plannedAttendance: { type: Number, default: 0 },
    actualAttendance:  { type: Number, default: 0 },
    feedbackScore:     { type: Number, min: 0, max: 5, default: 0 },
    keyObservations:   { type: String, default: '' },
    followUpRequired:  { type: Boolean, default: false },
    followUpNotes:     { type: String, default: '' },
    comments:          { type: String, default: '' },
    isFromTemplate:    { type: Boolean, default: false },
  },
  { timestamps: true }
)

WorkshopSchema.index({ schoolId: 1, status: 1, plannedDate: 1 })
WorkshopSchema.index({ schoolId: 1, programType: 1 })
WorkshopSchema.index({ conductedById: 1, plannedDate: 1 })
WorkshopSchema.index({ plannedDate: 1 })
WorkshopSchema.index({ theme: 1 })

export default mongoose.models.Workshop as mongoose.Model<IWorkshop>
  || mongoose.model<IWorkshop>('Workshop', WorkshopSchema)
