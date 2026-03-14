import mongoose, { Schema, Document, Model } from 'mongoose'

export type ErrorType = 'API_CRASH' | 'FRONTEND_CRASH' | 'AUTH_FAILURE' | 'SLOW_API'

export interface IErrorLogDoc extends Document {
  _id: mongoose.Types.ObjectId
  type:        ErrorType
  route:       string           // e.g. "/api/requests/[id]"
  method?:     string           // GET / POST / PATCH etc.
  message:     string           // short error message
  stack?:      string           // full stack trace (server errors)
  statusCode?: number           // HTTP status that was / would be returned
  durationMs?: number           // request duration (SLOW_API)
  userId?:     string
  userEmail?:  string
  userRole?:   string
  schoolId?:   string
  ipAddress?:  string
  userAgent?:  string
  metadata?:   Record<string, any>  // any extra context
  isResolved:  boolean
  resolvedAt?: Date
  resolvedBy?: string           // user email who marked it resolved
  createdAt:   Date
  updatedAt:   Date
}

const ErrorLogSchema = new Schema<IErrorLogDoc>(
  {
    type:       { type: String, enum: ['API_CRASH', 'FRONTEND_CRASH', 'AUTH_FAILURE', 'SLOW_API'], required: true },
    route:      { type: String, required: true },
    method:     { type: String },
    message:    { type: String, required: true },
    stack:      { type: String },
    statusCode: { type: Number },
    durationMs: { type: Number },
    userId:     { type: String },
    userEmail:  { type: String },
    userRole:   { type: String },
    schoolId:   { type: String },
    ipAddress:  { type: String },
    userAgent:  { type: String },
    metadata:   { type: Schema.Types.Mixed },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
  },
  { timestamps: true }
)

// Indexes for fast admin queries
ErrorLogSchema.index({ type: 1, createdAt: -1 })
ErrorLogSchema.index({ isResolved: 1, createdAt: -1 })
ErrorLogSchema.index({ route: 1, createdAt: -1 })

// Immutability guard — error logs must not be altered (except isResolved)
ErrorLogSchema.pre(['updateOne', 'findOneAndUpdate'] as any, function (next) {
  const update = (this as any).getUpdate?.()
  if (update) {
    // Only allow marking resolved
    const allowed = new Set(['isResolved', 'resolvedAt', 'resolvedBy', '$set', 'updatedAt'])
    const keys = Object.keys(update.$set || update)
    const forbidden = keys.filter((k) => !allowed.has(k))
    if (forbidden.length) {
      return next(new Error(`ErrorLog fields cannot be modified: ${forbidden.join(', ')}`))
    }
  }
  next()
})

const ErrorLog: Model<IErrorLogDoc> =
  mongoose.models.ErrorLog ||
  mongoose.model<IErrorLogDoc>('ErrorLog', ErrorLogSchema)

export default ErrorLog
