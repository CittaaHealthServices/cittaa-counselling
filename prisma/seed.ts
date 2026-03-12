/**
 * Cittaa Mind Bridge — Database Seed Script
 * Run: npm run seed
 *
 * Creates:
 *  - 1 Cittaa Admin
 *  - 1 Cittaa Support user
 *  - 2 Schools
 *  - Per school: 1 Principal, 1 School Admin, 1 Coordinator, 2 Class Teachers
 *  - 2 Psychologists (global, no school)
 *  - 1 RCI Team member
 *  - Sample students for each school
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI!
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not set in .env.local')
  process.exit(1)
}

// ─── Minimal inline schemas (avoids Next.js module resolution issues in seed) ─
const UserSchema = new mongoose.Schema({
  name:          String,
  email:         { type: String, unique: true },
  passwordHash:  String,
  role:          String,
  phone:         String,
  schoolId:      mongoose.Schema.Types.ObjectId,
  isActive:      { type: Boolean, default: true },
  isAvailable:   { type: Boolean, default: true },
  qualification: String,
  specialization:[String],
}, { timestamps: true })

const SchoolSchema = new mongoose.Schema({
  name:     String,
  code:     { type: String, unique: true },
  address:  String,
  city:     String,
  state:    String,
  pincode:  String,
  phone:    String,
  email:    String,
  isActive: { type: Boolean, default: true },
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
}, { timestamps: true })

const User    = mongoose.models.User    || mongoose.model('User',    UserSchema)
const School  = mongoose.models.School  || mongoose.model('School',  SchoolSchema)
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema)

async function hash(pw: string) {
  return bcrypt.hash(pw, 12)
}

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅  Connected to MongoDB')

  // ── Clear existing seed data ──────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({ email: { $regex: /@cittaa\.in$|@seed\.school$/ } }),
    School.deleteMany({ code: { $in: ['DPS-DEL', 'SVM-MUM'] } }),
  ])
  console.log('🧹  Cleared previous seed data')

  // ── Schools ───────────────────────────────────────────────────────────────
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
  console.log(`🏫  Created ${2} schools`)

  // ── Cittaa staff ──────────────────────────────────────────────────────────
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
  ])

  // ── Psychologists (global) ────────────────────────────────────────────────
  const [psychA, psychB] = await User.insertMany([
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
  ])

  // ── RCI Team ──────────────────────────────────────────────────────────────
  await User.create({
    name: 'Kavita (RCI Team)',
    email: 'rci@cittaa.in',
    passwordHash: await hash('Rci@2025'),
    role: 'RCI_TEAM',
  })

  // ── Per-school users ──────────────────────────────────────────────────────
  for (const [school, suffix] of [[schoolA, 'del'], [schoolB, 'mum']] as const) {
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
    const classes  = ['8', '9', '10']
    const sections = ['A', 'B']
    const studentDocs: any[] = []
    let roll = 1
    for (const cls of classes) {
      for (const sec of sections) {
        for (let i = 1; i <= 3; i++) {
          studentDocs.push({
            name:       `Student ${cls}${sec}${i}`,
            rollNumber: String(roll++).padStart(3, '0'),
            class:      cls,
            section:    sec,
            age:        parseInt(cls) + 5,
            gender:     i % 2 === 0 ? 'Female' : 'Male',
            parentName: `Parent of Student ${cls}${sec}${i}`,
            schoolId:   school._id,
          })
        }
      }
    }
    await Student.insertMany(studentDocs)
    console.log(`👩‍🎓  Created ${studentDocs.length} students for ${school.name}`)
  }

  console.log('\n✅  Seed complete!\n')
  console.log('─────────────────────────────────────────────────────')
  console.log('Login credentials (all schools use same passwords):')
  console.log('  Cittaa Admin:     admin@cittaa.in            Cittaa@2025')
  console.log('  Cittaa Support:   support@cittaa.in          Support@2025')
  console.log('  Psychologist:     ananya@cittaa.in           Psych@2025')
  console.log('  RCI Team:         rci@cittaa.in              Rci@2025')
  console.log('  Principal (DEL):  principal@del.seed.school  Principal@2025')
  console.log('  School Admin:     admin@del.seed.school      Admin@2025')
  console.log('  Coordinator:      coordinator@del.seed.school Coord@2025')
  console.log('  Class Teacher:    teacher8@del.seed.school   Teacher@2025')
  console.log('─────────────────────────────────────────────────────\n')

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err)
  process.exit(1)
})
