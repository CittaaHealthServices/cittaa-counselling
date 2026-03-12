import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISchoolDoc extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  code: string              // Unique short code e.g. "DPS-DEL"
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  principalName?: string
  totalStudents?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const SchoolSchema = new Schema<ISchoolDoc>(
  {
    name:            { type: String, required: true, trim: true },
    code:            { type: String, required: true, unique: true, uppercase: true, trim: true },
    address:         { type: String, required: true },
    city:            { type: String, required: true },
    state:           { type: String, required: true },
    pincode:         { type: String, required: true },
    phone:           { type: String, required: true },
    email:           { type: String, required: true, unique: true, lowercase: true },
    principalName:   { type: String },
    totalStudents:   { type: Number },
    isActive:        { type: Boolean, default: true },
  },
  { timestamps: true }
)

const School: Model<ISchoolDoc> =
  mongoose.models.School || mongoose.model<ISchoolDoc>('School', SchoolSchema)

export default School
