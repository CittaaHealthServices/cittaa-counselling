import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

// Cached connection for Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null }
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectDB(): Promise<mongoose.Connection> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize:    25,      // raised for 40-school / 60k-student production load
      minPoolSize:    5,       // keep minimum connections warm
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 60000,
      heartbeatFrequencyMS: 30000,
    }
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m.connection)
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default connectDB
