import mongoose, { Schema, Document, Model } from 'mongoose'

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
  },
  { timestamps: true }
)

// Compound index: roll number unique per school
StudentSchema.index({ rollNumber: 1, schoolId: 1 }, { unique: true, sparse: true })

const Student: Model<IStudentDoc> =
  mongoose.models.Student || mongoose.model<IStudentDoc>('Student', StudentSchema)

export default Student
