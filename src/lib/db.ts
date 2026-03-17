/**
 * db.ts — MongoDB connection with auto-reconnect, connection pooling,
 * and self-healing on transient errors.
 */
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set')
}

// ── Connection options ────────────────────────────────────────────────────────
const CONNECT_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize:        10,   // max simultaneous connections
  minPoolSize:        2,    // keep at least 2 alive
  serverSelectionTimeoutMS: 8_000,   // fail fast if Mongo unreachable
  socketTimeoutMS:    45_000,
  connectTimeoutMS:   10_000,
  heartbeatFrequencyMS: 10_000,      // check server health every 10s
  retryWrites:        true,
  retryReads:         true,
}

// ── Module-level cache (survives hot reloads in dev) ─────────────────────────
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

// ── Attach lifecycle event handlers once ─────────────────────────────────────
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
    // Wipe the cached promise so the next call triggers a fresh connect
    cache.conn    = null
    cache.promise = null
  })

  mongoose.connection.on('error', (err) => {
    cache.errors++
    cache.lastErr = new Date()
    console.error(`[DB] Error #${cache.errors}:`, err.message)
    // Wipe cache so next request attempts a fresh connection
    cache.conn    = null
    cache.promise = null
  })

  // SIGINT / SIGTERM — close the pool cleanly
  const graceful = async (signal: string) => {
    await mongoose.connection.close()
    console.log(`[DB] Connection closed on ${signal}`)
    process.exit(0)
  }
  process.once('SIGINT',  () => graceful('SIGINT'))
  process.once('SIGTERM', () => graceful('SIGTERM'))
}

// ── Main export ───────────────────────────────────────────────────────────────
export default async function connectDB(): Promise<typeof mongoose> {
  // Already connected
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn

  // Wait for an in-flight connection attempt
  if (cache.promise) return cache.promise

  attachListeners()

  // If we've had repeated recent errors, add a short back-off
  if (cache.errors >= 3 && cache.lastErr) {
    const msSinceLast = Date.now() - cache.lastErr.getTime()
    if (msSinceLast < 5_000) {
      // Let the caller handle the back-off: throw after 3 quick failures
      throw new Error(`[DB] Too many recent errors (${cache.errors}). Backing off.`)
    }
    // Reset counter after back-off window
    cache.errors = 0
  }

  cache.promise = mongoose
    .connect(MONGODB_URI, CONNECT_OPTIONS)
    .then(m => {
      cache.conn    = m
      cache.promise = null   // clear so re-use works on reconnect
      return m
    })
    .catch(err => {
      cache.promise = null   // allow retry on next request
      cache.errors++
      cache.lastErr = new Date()
      throw err
    })

  return cache.promise
}
