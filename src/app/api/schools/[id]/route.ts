import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import School from '@/models/School'

// GET /api/schools/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  try {
    const school = await School.findById(params.id).lean()
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }
    return NextResponse.json({ school })
  } catch (err) {
    console.error('GET /api/schools/[id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH /api/schools/:id — CITTAA_ADMIN only
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user.role as string
  if (!['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  try {
    const body = await req.json()

    // Allowed fields
    const allowed = [
      'name', 'address', 'city', 'state', 'pincode',
      'contactEmail', 'contactPhone', 'principalName',
      'isActive', 'board', 'type',
    ]
    const update: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    const school = await School.findByIdAndUpdate(
      params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean()

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    return NextResponse.json({ school })
  } catch (err) {
    console.error('PATCH /api/schools/[id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/schools/:id — CITTAA_ADMIN only (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user.role as string
  if (role !== 'CITTAA_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  try {
    const school = await School.findByIdAndUpdate(
      params.id,
      { $set: { isActive: false } },
      { new: true }
    ).lean()

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'School deactivated' })
  } catch (err) {
    console.error('DELETE /api/schools/[id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
