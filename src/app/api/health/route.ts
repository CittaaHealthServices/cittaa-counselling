import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import os from 'os'

export const dynamic = 'force-dynamic'

// Simple in-memory uptime tracker (resets on cold start)
const BOOT_TIME = Date.now()

export async function GET(req: NextRequest) {
  const start = Date.now()

  // ── DB check ────────────────────────────────────────────────────────────────
  let dbStatus: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected'
  let dbLatencyMs = -1
  try {
    await connectDB()
    const dbStart = Date.now()
    // Ping the DB — fastest possible round-trip
    await mongoose.connection.db!.command({ ping: 1 })
    dbLatencyMs = Date.now() - dbStart
    const state = mongoose.connection.readyState
    dbStatus = state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected'
  } catch (e) {
    dbStatus = 'error'
  }

  // ── Memory ──────────────────────────────────────────────────────────────────
  const memUsed  = process.memoryUsage()
  const freeRam  = os.freemem()
  const totalRam = os.totalmem()

  // ── Overall health ──────────────────────────────────────────────────────────
  const healthy = dbStatus === 'connected'
  const status  = healthy ? 200 : 503

  const body = {
    status:    healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - BOOT_TIME) / 1000),
    responseTimeMs: Date.now() - start,
    services: {
      database: {
        status:    dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
    system: {
      nodeVersion:  process.version,
      heapUsedMB:   Math.round(memUsed.heapUsed  / 1024 / 1024),
      heapTotalMB:  Math.round(memUsed.heapTotal / 1024 / 1024),
      rssMB:        Math.round(memUsed.rss       / 1024 / 1024),
      freeRamMB:    Math.round(freeRam           / 1024 / 1024),
      totalRamMB:   Math.round(totalRam          / 1024 / 1024),
    },
  }

  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache',
      'X-Health-Status': healthy ? 'ok' : 'degraded',
    },
  })
}
