/**
 * ONE-TIME DATABASE SEED ENDPOINT
 * GET /api/seed?secret=cittaa-seed-2025
 *
 * Creates admin + support + sample school users.
 * DELETE or disable this file after first use.
 */
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const SEED_SECRET = 'cittaa-seed-2025'

const MONGODB_URI = process.env.MONGODB_URI!

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return
  await mongoose.connect(MONGODB_URI)
}

const UserSchema = new mongoose.Schema({
  name:         String,
  email:        { type: String, unique: true },
  passwordHash: String,
  role:         String,
  phone:        String,
  schoolId:     mongoose.Schema.Types.ObjectId,
  isActive:     { type: Boolean, default: true },
  isAvailable:  { type: Boolean, default: true },
  qualification:   String,
  specialization:  [String],
}, { timestamps: true })

const SchoolSchema = new mongoose.Schema({
  name:    String,
  code:    { type: String, unique: true },
  address: String,
  city:    String,
  state:   String,
  pincode: String,
  phone:   String,
  email:   String,
  isActive:{ type: Boolean, default: true },
}, { timestamps: true })

const StudentSchema = new mongoose.Schema({
  name:       String,
  rollNumber: String,
  class:      String,
  section:    String,
  age:        Number,
  gender:     String,
  parentName: String,
  parentPhone:String,
  schoolId:   mongoose.Schema.Types.ObjectId,
  isActive:   { type: Boolean, default: true },
}, { timestamps: true })

function getModels() {
  const User    = mongoose.models.User    || mongoose.model('User',    UserSchema)
  const School  = mongoose.models.School  || mongoose.model('School',  SchoolSchema)
  const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema)
  return { User, School, Student }
}

async function hash(pw: string) {
  return bcrypt.hash(pw, 12)
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')

  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!MONGODB_URI) {
    return NextResponse.json({ error: 'MONGODB_URI not set in environment variables' }, { status: 500 })
  }

  try {
    await connectDB()
    const { User, School, Student } = getModels()

    // ── Clear old seed data ──────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({ email: { $regex: /@cittaa\.in$|@seed\.school$/ } }),
      School.deleteMany({ code: { $in: ['DPS-DEL', 'SVM-MUM'] } }),
    ])

    // ── Schools ──────────────────────────────────────────────────────────
    const [schoolA, schoolB] = await School.insertMany([
      {
        name: 'Delhi Public School – New Delhi',
        code: 'DPS-DEL',
        address: 'Mathura Road, New Delhi',
        city: 'New Delhi', state: 'Delhi', pincode: '110003',
        phone: '011-23456789', email: 'principal@dps-del.seed.school',
      },
      {
        name: 'Saraswati Vidya Mandir – Mumbai',
        code: 'SVM-MUM',
        address: 'Andheri West, Mumbai',
        city: 'Mumbai', state: 'Maharashtra', pincode: '400058',
        phone: '022-98765432', email: 'principal@svm-mum.seed.school',
      },
    ])

    // ── Cittaa core staff ────────────────────────────────────────────────
    await User.insertMany([
      {
        name: 'Sairam (Cittaa Admin)',
        email: 'admin@cittaa.in',
        passwordHash: await hash('Cittaa@2025'),
        role: 'CITTAA_ADMIN',
      },
      {
        name: 'Priya (IT Support)',
        email: 'support@cittaa.in',
        passwordHash: await hash('Support@2025'),
        role: 'CITTAA_SUPPORT',
      },
      {
        name: 'Dr. Ananya Sharma',
        email: 'ananya@cittaa.in',
        passwordHash: await hash('Psych@2025'),
        role: 'PSYCHOLOGIST',
        qualification: 'M.Phil Clinical Psychology',
        specialization: ['Child Psychology', 'Adolescent Counselling'],
      },
      {
        name: 'Dr. Rahul Mehta',
        email: 'rahul@cittaa.in',
        passwordHash: await hash('Psych@2025'),
        role: 'PSYCHOLOGIST',
        qualification: 'Ph.D Psychology',
        specialization: ['ADHD', 'Learning Disabilities'],
      },
      {
        name: 'Kavita (RCI Team)',
        email: 'rci@cittaa.in',
        passwordHash: await hash('Rci@2025'),
        role: 'RCI_TEAM',
      },
    ])

    // ── Per-school users + students ──────────────────────────────────────
    const schools = [
      { school: schoolA, suffix: 'del' },
      { school: schoolB, suffix: 'mum' },
    ]
    let totalStudents = 0

    for (const { school, suffix } of schools) {
      await User.insertMany([
        {
          name: `Principal ${suffix.toUpperCase()}`,
          email: `principal@${suffix}.seed.school`,
          passwordHash: await hash('Principal@2025'),
          role: 'SCHOOL_PRINCIPAL',
          schoolId: school._id,
        },
        {
          name: `Admin IT ${suffix.toUpperCase()}`,
          email: `admin@${suffix}.seed.school`,
          passwordHash: await hash('Admin@2025'),
          role: 'SCHOOL_ADMIN',
          schoolId: school._id,
        },
        {
          name: `Coordinator ${suffix.toUpperCase()}`,
          email: `coordinator@${suffix}.seed.school`,
          passwordHash: await hash('Coord@2025'),
          role: 'COORDINATOR',
          schoolId: school._id,
        },
        {
          name: `Teacher Meena (Class 8) ${suffix.toUpperCase()}`,
          email: `teacher8@${suffix}.seed.school`,
          passwordHash: await hash('Teacher@2025'),
          role: 'CLASS_TEACHER',
          schoolId: school._id,
        },
        {
          name: `Teacher Ramesh (Class 9) ${suffix.toUpperCase()}`,
          email: `teacher9@${suffix}.seed.school`,
          passwordHash: await hash('Teacher@2025'),
          role: 'CLASS_TEACHER',
          schoolId: school._id,
        },
      ])

      // Sample students
      const studentDocs: any[] = []
      let roll = 1
      for (const cls of ['8', '9', '10']) {
        for (const sec of ['A', 'B']) {
          for (let i = 1; i <= 3; i++) {
            studentDocs.push({
              name:       `Student ${cls}${sec}${i}`,
              rollNumber: String(roll++).padStart(3, '0'),
              class: cls, section: sec,
              age:   parseInt(cls) + 5,
              gender: i % 2 === 0 ? 'Female' : 'Male',
              parentName: `Parent of Student ${cls}${sec}${i}`,
              schoolId: school._id,
              isActive: true,
            })
          }
        }
      }
      await Student.insertMany(studentDocs)
      totalStudents += studentDocs.length
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      created: {
        schools: 2,
        students: totalStudents,
      },
      credentials: [
        { role: 'CITTAA_ADMIN',      email: 'admin@cittaa.in',              password: 'Cittaa@2025' },
        { role: 'CITTAA_SUPPORT',    email: 'support@cittaa.in',            password: 'Support@2025' },
        { role: 'PSYCHOLOGIST',      email: 'ananya@cittaa.in',             password: 'Psych@2025' },
        { role: 'RCI_TEAM',          email: 'rci@cittaa.in',                password: 'Rci@2025' },
        { role: 'SCHOOL_PRINCIPAL',  email: 'principal@del.seed.school',    password: 'Principal@2025' },
        { role: 'SCHOOL_ADMIN',      email: 'admin@del.seed.school',        password: 'Admin@2025' },
        { role: 'COORDINATOR',       email: 'coordinator@del.seed.school',  password: 'Coord@2025' },
        { role: 'CLASS_TEACHER',     email: 'teacher8@del.seed.school',     password: 'Teacher@2025' },
      ],
    })
  } catch (err) {
    return NextResponse.json({
      error: 'Seed failed',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
