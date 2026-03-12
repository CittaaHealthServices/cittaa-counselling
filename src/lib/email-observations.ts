/**
 * Email templates for Observations & Session Reminders
 * These are additive to the core email.ts file.
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM || 'Cittaa Mind Bridge <noreply@cittaa.in>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://counseling.cittaa.in'

function base(content: string, title: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:20px}
    .wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .hdr{background:#2563EB;padding:20px 28px}.hdr-logo{color:#fff;font-size:18px;font-weight:700}
    .hdr-sub{color:#bfdbfe;font-size:12px;margin-top:3px}
    .bdy{padding:24px 28px}.ttl{font-size:17px;font-weight:600;color:#0f172a;margin:0 0 10px}
    .txt{font-size:13px;color:#475569;line-height:1.7;margin:0 0 14px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:14px 0}
    .row{display:flex;justify-content:space-between;margin-bottom:7px}
    .lbl{font-size:11px;color:#94a3b8;font-weight:500}.val{font-size:12px;color:#1e293b;font-weight:600;text-align:right}
    .btn{display:inline-block;background:#2563EB;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-top:6px}
    .ftr{background:#f8fafc;padding:14px 28px;text-align:center;font-size:11px;color:#94a3b8}
    .badge-purple{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#ede9fe;color:#6d28d9}
    .badge-orange{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#ffedd5;color:#c2410c}
    .badge-green{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dcfce7;color:#15803d}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><div class="hdr-logo">🧠 Cittaa Mind Bridge</div><div class="hdr-sub">School Counselling Management Platform</div></div>
    <div class="bdy"><div class="ttl">${title}</div>${content}</div>
    <div class="ftr">Cittaa Health Services Pvt. Ltd. · Automated message · Do not reply</div>
  </div></body></html>`
}

async function send(to: string | string[], subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html })
  } catch (e) { console.error('[Resend]', e) }
}

// ─── Observation shared with teacher ─────────────────────────────────────────
export async function sendObservationSharedEmail(opts: {
  to: string
  teacherName: string
  psychologistName: string
  studentName: string
  studentClass: string
  classVisitDate: string
  classObserved: string
  behaviourFlags: string[]
  recommendEscalation: boolean
  observationId: string
}) {
  const flagStr = opts.behaviourFlags.length > 0
    ? opts.behaviourFlags.map((f) => `<span style="display:inline-block;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;font-size:11px;margin:2px">${f}</span>`).join(' ')
    : '<em style="color:#94a3b8">None flagged</em>'

  const content = `
    <p class="txt">Hello ${opts.teacherName},</p>
    <p class="txt">Psychologist <strong>${opts.psychologistName}</strong> has shared classroom observation notes for your student. Please review and decide on next steps.</p>
    ${opts.recommendEscalation ? '<span class="badge-orange">⚠ Psychologist recommends formal counselling session</span><br/><br/>' : ''}
    <div class="box">
      <div class="row"><span class="lbl">Student</span><span class="val">${opts.studentName}</span></div>
      <div class="row"><span class="lbl">Class</span><span class="val">${opts.studentClass}</span></div>
      <div class="row"><span class="lbl">Visit Date</span><span class="val">${opts.classVisitDate}</span></div>
      <div class="row"><span class="lbl">Class Observed</span><span class="val">${opts.classObserved}</span></div>
      <div class="row"><span class="lbl">Behaviour Flags</span><span class="val">${flagStr}</span></div>
    </div>
    <p class="txt">Please log in to review the full notes and choose to <strong>escalate</strong> (create a counselling request) or <strong>acknowledge</strong> (no action needed).</p>
    <a href="${APP_URL}/dashboard/observations/${opts.observationId}" class="btn">Review Observation →</a>
  `
  return send(opts.to, `[Review Needed] Classroom Observation – ${opts.studentName}`,
    base(content, 'Classroom Observation Shared With You 📋'))
}

// ─── Teacher approved → escalated to counselling ─────────────────────────────
export async function sendObservationEscalatedEmail(opts: {
  toPsychologist: string
  psychologistName: string
  teacherName: string
  studentName: string
  requestNumber: string
  requestId: string
}) {
  const content = `
    <p class="txt">Hello ${opts.psychologistName},</p>
    <p class="txt"><strong>${opts.teacherName}</strong> has approved the escalation of your classroom observation for student <strong>${opts.studentName}</strong>. A counselling request has been created automatically.</p>
    <span class="badge-green">Counselling Request Created</span>
    <div class="box">
      <div class="row"><span class="lbl">Request No.</span><span class="val">${opts.requestNumber}</span></div>
      <div class="row"><span class="lbl">Student</span><span class="val">${opts.studentName}</span></div>
    </div>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Request →</a>
  `
  return send(opts.toPsychologist, `Observation Escalated – Request ${opts.requestNumber} Created`,
    base(content, 'Observation Approved & Request Created ✓'))
}

// ─── Session Reminder (sent to teacher/coordinator) ───────────────────────────
export async function sendSessionReminderEmail(opts: {
  to: string
  teacherName: string
  studentName: string
  studentClass: string
  requestNumber: string
  scheduledAt: string
  psychologistName: string
  hoursUntil: number
  requestId: string
}) {
  const urgency = opts.hoursUntil <= 2 ? 'Today' : opts.hoursUntil <= 24 ? 'Tomorrow' : 'Upcoming'
  const content = `
    <p class="txt">Hello ${opts.teacherName},</p>
    <p class="txt">This is a reminder that a counselling session is scheduled for your student.</p>
    <span class="badge-purple">Session ${urgency}</span>
    <div class="box">
      <div class="row"><span class="lbl">Student</span><span class="val">${opts.studentName}</span></div>
      <div class="row"><span class="lbl">Class</span><span class="val">${opts.studentClass}</span></div>
      <div class="row"><span class="lbl">Session Time</span><span class="val">${opts.scheduledAt}</span></div>
      <div class="row"><span class="lbl">Psychologist</span><span class="val">${opts.psychologistName}</span></div>
      <div class="row"><span class="lbl">Request No.</span><span class="val">${opts.requestNumber}</span></div>
    </div>
    <p class="txt">Please ensure the student is informed and available for the session.</p>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Session Details →</a>
  `
  return send(opts.to, `[Session Reminder] ${opts.studentName} – ${opts.scheduledAt}`,
    base(content, `Session Reminder 🗓️`))
}

// ─── Immediate session notification (to submitter when session is first scheduled) ──
export async function sendSessionNotificationToTeacher(opts: {
  to: string
  teacherName: string
  studentName: string
  studentClass: string
  requestNumber: string
  scheduledAt: string
  psychologistName: string
  requestId: string
}) {
  const content = `
    <p class="txt">Hello ${opts.teacherName},</p>
    <p class="txt">A counselling session has been scheduled for your student <strong>${opts.studentName}</strong>. Please note the details below and ensure the student is available at the scheduled time.</p>
    <div class="box">
      <div class="row"><span class="lbl">Student</span><span class="val">${opts.studentName}</span></div>
      <div class="row"><span class="lbl">Class</span><span class="val">${opts.studentClass}</span></div>
      <div class="row"><span class="lbl">Scheduled At</span><span class="val">${opts.scheduledAt}</span></div>
      <div class="row"><span class="lbl">Psychologist</span><span class="val">${opts.psychologistName}</span></div>
    </div>
    <p class="txt">You will receive a reminder 24 hours before the session.</p>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Full Details →</a>
  `
  return send(opts.to, `Session Confirmed for ${opts.studentName} – ${opts.scheduledAt}`,
    base(content, 'Counselling Session Confirmed 📅'))
}
