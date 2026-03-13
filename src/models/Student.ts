import mongoose, { Schema, Document, Model } from 'mongoose'
import { generateCodeName } from '@/lib/codename'

export interface IStudentDoc extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  rollNumber?: string
  class: string
  section?: string
  age?: number
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  schoolId: mongoose.Types.ObjectId
  isActive: boolean
  /** Stable anonymisation code shown when request is confidential */
  codeName?: string
  createdAt: Date
  updatedAt: Date
}

const StudentSchema = new Schema<IStudentDoc>(
  {
    name:        { type: String, required: true, trim: true },
    rollNumber:  { type: String },
    class:       { type: String, required: true },
    section:     { type: String },
    age:         { type: Number },
    gender:      { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
    parentName:  { type: String },
    parentPhone: { type: String },
    parentEmail: { type: String, lowercase: true },
    schoolId:    { type: Schema.Types.ObjectId, ref: 'School', required: true },
    isActive:    { type: Boolean, default: true },
    codeName:    { type: String },          // stable anonymisation code
  },
  { timestamps: true }
)

// Auto-generate codeName before first save so it's always present
StudentSchema.pre('save', function (next) {
  if (!this.codeName) {
    this.codeName = generateCodeName({
      class:      this.class,
      section:    this.section,
      rollNumber: this.rollNumber,
      _id:        this._id,
    })
  }
  next()
})

// Compound index: roll number unique per school
StudentSchema.index({ rollNumber: 1, schoolId: 1 }, { unique: true, sparse: true })
// Performance indexes for 60k+ student queries
StudentSchema.index({ schoolId: 1, isActive: 1, name: 1 })       // school student list + name search
StudentSchema.index({ schoolId: 1, class: 1, section: 1 })        // class/section filter
StudentSchema.index({ name: 'text' })                              // full-text search on name

const Student: Model<IStudentDoc> =
  mongoose.models.Student || mongoose.model<IStudentDoc>('Student', StudentSchema)

export default Student
