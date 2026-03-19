/**
 * db.ts — MongoDB connection with auto-reconnect, connection pooling,
 * and self-healing on transient errors.
 *
 * NOTE: MONGODB_URI check is intentionally deferred to connectDB() call-time,
 * NOT at module import time. This prevents Next.js build-time crashes when
 * the env var is absent (e.g. on a developer's local machine without .env.local).
 */
import mongoose from 'mongoose'

// Connection options
const CONNECT_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize:              10,    // max simultaneous connections
  minPoolSize:              2,     // keep at least 2 alive
  serverSelectionTimeoutMS: 8_000, // fail fast if Mongo unreachable
  socketTimeoutMS:          45_000,
  connectTimeoutMS:         10_000,
  heartbeatFrequencyMS:     10_000, // check server health every 10s
  retryWrites:              true,
  retryReads:               true,
}

// Module-level cache (survives hot reloads in dev)
declare global {
  // eslint-disable-next-line no-var
  var _mongoCache: {
    conn:    typeof mongoose | null
    promise: Promise<typeof mongoose> | null
    errors:  number
    lastErr: Date | null
  }
}

if (!global._mongoCache) {
  global._mongoCache = { conn: null, promise: null, errors: 0, lastErr: null }
}
const cache = global._mongoCache

// Attach lifecycle event handlers once
let _listenersAttached = false
function attachListeners() {
  if (_listenersAttached) return
  _listenersAttached = true

  mongoose.connection.on('connected', () => {
    cache.errors = 0
    if (process.env.NODE_ENV !== 'production') console.log('[DB] Connected')
  })
  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Disconnected — will auto-reconnect on next request')
    cache.conn    = null
    cache.promise = null
  })
  mongoose.connection.on('error', (err) => {
    cache.errors++
    cache.lastErr = new Date()
    console.error(`[DB] Error #${cache.errors}:`, err.message)
    cache.conn    = null
    cache.promise = null
  })

  // Close the pool cleanly on shutdown
  const graceful = async (signal: string) => {
    await mongoose.connection.close()
    console.log(`[DB] Connection closed on ${signal}`)
    process.exit(0)
  }
  process.once('SIGINT',  () => graceful('SIGINT'))
  process.once('SIGTERM', () => graceful('SIGTERM'))
}

// Main export
export default async function connectDB(): Promise<typeof mongoose> {
  // ── Defer env check to call-time (not import-time) ──────────────────────────
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not set. ' +
      'Set it in Railway (production) or create .env.local (local dev).'
    )
  }

  // Already connected
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn

  // Wait for an in-flight connection attempt
  if (cache.promise) return cache.promise

  attachListeners()

  // Back-off after repeated recent errors
  if (cache.errors >= 3 && cache.lastErr) {
    const msSinceLast = Date.now() - cache.lastErr.getTime()
    if (msSinceLast < 5_000) {
      throw new Error(`[DB] Too many recent errors (${cache.errors}). Backing off.`)
    }
    cache.errors = 0
  }

  cache.promise = mongoose
    .connect(MONGODB_URI, CONNECT_OPTIONS)
    .then(m => {
      cache.conn    = m
      cache.promise = null
      return m
    })
    .catch(err => {
      cache.promise = null
      cache.errors++
      cache.lastErr = new Date()
      throw err
    })

  return cache.promise
}
