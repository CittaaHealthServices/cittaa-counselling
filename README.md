# Cittaa Mind Bridge

School counselling management platform — structured, role-based digital workflow replacing verbal communication for student counselling requests, sessions, assessments, and RCI coordination across 20+ schools.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Auth | NextAuth.js v4 (JWT, 24h) |
| Email | Resend |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Deployment | Railway |

---

## Roles

| Role | Description |
|---|---|
| `CITTAA_ADMIN` | Full access across all schools |
| `CITTAA_SUPPORT` | IT/Support — read-only global access |
| `SCHOOL_PRINCIPAL` | School-level approval authority |
| `SCHOOL_ADMIN` | School admin (IT/office) — manages users & students |
| `COORDINATOR` | Submit requests, view their class |
| `CLASS_TEACHER` | Submit requests for their students, review observations |
| `PSYCHOLOGIST` | Manage sessions, record observations, request assessments |
| `RCI_TEAM` | Receive assignments, submit field reports |

---

## Request Lifecycle

```
PENDING_APPROVAL → APPROVED → PSYCHOLOGIST_ASSIGNED → SESSION_SCHEDULED →
SESSION_COMPLETED → ASSESSMENT_REQUESTED → ASSESSMENT_APPROVED →
RCI_NOTIFIED → RCI_VISITING → RCI_REPORT_SUBMITTED → CLOSED
```

## Observation Lifecycle

```
DRAFT → SHARED → ACKNOWLEDGED (no further action)
                 ESCALATED   (auto-creates counselling request, pre-assigns psychologist)
                 DECLINED
```

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/your-org/cittaa-counseling.git
cd cittaa-counseling
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

Required variables:
- `MONGODB_URI` — MongoDB Atlas connection string
- `NEXTAUTH_SECRET` — Random string (min 32 chars), generate with: `openssl rand -hex 32`
- `NEXTAUTH_URL` — Your app URL (`http://localhost:3000` for dev)
- `RESEND_API_KEY` — Get from resend.com
- `RESEND_FROM_EMAIL` — Verified sender domain in Resend
- `CRON_SECRET` — Random string for protecting the cron endpoint

### 3. Seed the database

```bash
npm run seed
```

This creates sample Cittaa admin, 2 schools, all role types, and sample students.

**Default seed credentials:**

| Role | Email | Password |
|---|---|---|
| Cittaa Admin | admin@cittaa.in | Cittaa@2025 |
| Cittaa Support | support@cittaa.in | Support@2025 |
| Psychologist | ananya@cittaa.in | Psych@2025 |
| RCI Team | rci@cittaa.in | Rci@2025 |
| Principal (DEL) | principal@del.seed.school | Principal@2025 |
| School Admin | admin@del.seed.school | Admin@2025 |
| Coordinator | coordinator@del.seed.school | Coord@2025 |
| Class Teacher | teacher8@del.seed.school | Teacher@2025 |

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deployment on Railway

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Cittaa Mind Bridge"
git remote add origin https://github.com/your-org/cittaa-counseling.git
git push -u origin main
```

### 2. Create Railway project

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo
2. Select `cittaa-counseling`
3. Railway auto-detects Next.js via `nixpacks.toml`

### 3. Set environment variables in Railway

Go to your Railway service → Variables tab → Add:
- All variables from `.env.example`
- Set `NEXTAUTH_URL` to your Railway domain (e.g. `https://cittaa-counseling.up.railway.app`)
- Set `NEXT_PUBLIC_APP_URL` to the same Railway domain

### 4. Session Reminders Cron

Set up a cron job (Railway Cron, GitHub Actions, or external) to call:

```
POST https://your-app.railway.app/api/sessions/reminders
Authorization: Bearer YOUR_CRON_SECRET
```

Recommended: every day at 8 AM IST (2:30 AM UTC):
```
30 2 * * *
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           NextAuth handler
│   │   ├── dashboard/      Stats API
│   │   ├── health/         Railway health check
│   │   ├── observations/   Classroom observations CRUD
│   │   ├── requests/       Counselling requests + actions
│   │   ├── schools/        School management
│   │   ├── sessions/       Session scheduling + reminders
│   │   ├── students/       Student management + bulk upload
│   │   └── users/          User management
│   ├── dashboard/          All authenticated pages
│   └── login/              Login page
├── components/
│   ├── dashboard/          UpcomingSessions widget
│   └── layout/             Sidebar, Header
├── lib/
│   ├── auth.ts             NextAuth config
│   ├── db.ts               MongoDB connection
│   ├── email.ts            Resend email templates
│   ├── email-observations.ts Observation email templates
│   └── utils.ts            Helpers, IST timezone
├── middleware.ts            Route protection
├── models/                 Mongoose models
└── types/                  Shared TypeScript types
```

---

## Key Features

- **Multi-tenant**: 20+ schools, all data scoped by `schoolId`
- **IST Timezone**: All dates displayed in `Asia/Kolkata`
- **Classroom Observations**: Psychologist records notes → shares with teacher → teacher escalates to counselling or acknowledges
- **Substitute Psychologist**: When assigned psychologist is unavailable, a substitute is auto-assigned
- **Session Reminders**: Automated daily cron sends 24h reminders to teachers; teachers see upcoming sessions on their dashboard
- **Bulk Student Upload**: CSV or JSON array upload for up to 2000 students at once
- **Scale**: All list queries use pagination + `.lean()` + compound indexes for 10k+ records
- **Principal Dashboard**: Daily/weekly/monthly observation counts, per-psychologist breakdown, class-level detail
- **Cittaa Admin Dashboard**: Cross-school counselling + observation stats

---

## MongoDB Indexes

| Collection | Indexes |
|---|---|
| CounselingRequest | `{schoolId,status}`, `{assignedPsychologistId,status}`, `{studentId}`, `{createdAt:-1}` |
| Observation | `{schoolId,status}`, `{psychologistId}`, `{sharedWithId,status}`, `{studentId}` |
| Session | `{requestId}`, `{psychologistId,status}`, `{scheduledAt}` |
| Notification | `{userId,isRead,createdAt:-1}` |
| Student | `{rollNumber,schoolId}` (unique) |
