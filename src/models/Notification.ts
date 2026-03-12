import mongoose, { Schema, Document, Model } from 'mongoose'
import { NotificationType } from '@/types'

export interface INotificationDoc extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  link?: string            // Deep link to relevant page
  relatedId?: string       // ID of related request/session/assessment
  createdAt: Date
}

const NotificationSchema = new Schema<INotificationDoc>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    type:      { type: String, required: true },
    isRead:    { type: Boolean, default: false },
    link:      { type: String },
    relatedId: { type: String },
  },
  { timestamps: true, updatedAt: false }
)

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })

const Notification: Model<INotificationDoc> =
  mongoose.models.Notification || mongoose.model<INotificationDoc>('Notification', NotificationSchema)

export default Notification
