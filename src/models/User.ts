import mongoose, { Schema, Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'
import { Role } from '@/types'

export interface IUserDoc extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  username?: string                      // optional short login handle (e.g. "principal_demo")
  passwordHash: string
  role: Role
  phone?: string
  schoolId?: mongoose.Types.ObjectId    // null for CITTAA_ADMIN, PSYCHOLOGIST, RCI_TEAM
  isActive: boolean
  isAvailable: boolean                   // for PSYCHOLOGIST — availability flag
  qualification?: string                 // for psychologists
  specialization?: string[]             // for psychologists
  employeeId?: string
  profilePhoto?: string
  createdBy?: mongoose.Types.ObjectId   // Who created this user (for school sub-logins)
  lastLogin?: Date
  resetToken?: string                    // for password reset / first-time set-password
  resetTokenExpiry?: Date               // token validity window
  createdAt: Date
  updatedAt: Date
  verifyPassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUserDoc>(
  {
    name:           { type: String, required: true, trim: true },
    email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
    username:       { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash:   { type: String, required: true },
    role:           {
      type: String,
      enum: ['CITTAA_ADMIN','CITTAA_SUPPORT','SCHOOL_PRINCIPAL','SCHOOL_ADMIN',
             'COORDINATOR','CLASS_TEACHER','PSYCHOLOGIST','RCI_TEAM'],
      required: true,
    },
    phone:            { type: String },
    schoolId:         { type: Schema.Types.ObjectId, ref: 'School' },
    isActive:         { type: Boolean, default: true },
    isAvailable:      { type: Boolean, default: true },
    qualification:    { type: String },
    specialization:   [{ type: String }],
    employeeId:       { type: String },
    profilePhoto:     { type: String },
    createdBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    lastLogin:        { type: Date },
    resetToken:       { type: String, select: false },
    resetTokenExpiry: { type: Date,   select: false },
  },
  { timestamps: true }
)

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
  next()
})

// Verify password
UserSchema.methods.verifyPassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash)
}

const User: Model<IUserDoc> =
  mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema)

export default User
