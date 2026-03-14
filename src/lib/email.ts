import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'Cittaa Mind Bridge <noreply@cittaa.in>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://counseling.cittaa.in'

// ─── Base email template ──────────────────────────────────────────────────────
function baseTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:20px; }
    .container { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
    .header { background:#7c3aed; padding:24px 32px; }
    .header-logo { color:#ffffff; font-size:20px; font-weight:700; letter-spacing:-0.3px; }
    .header-sub  { color:#ddd6fe; font-size:13px; margin-top:4px; }
    .body   { padding:28px 32px; }
    .title  { font-size:18px; font-weight:600; color:#0f172a; margin:0 0 12px; }
    .text   { font-size:14px; color:#475569; line-height:1.7; margin:0 0 16px; }
    .badge  { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; margin-bottom:16px; }
    .badge-blue   { background:#ede9fe; color:#6d28d9; }
    .badge-orange { background:#ffedd5; color:#c2410c; }
    .badge-red    { background:#fee2e2; color:#b91c1c; }
    .badge-green  { background:#dcfce7; color:#15803d; }
    .info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:16px 0; }
    .info-row { display:flex; justify-content:space-between; margin-bottom:8px; }
    .info-label { font-size:12px; color:#94a3b8; font-weight:500; }
    .info-value { font-size:13px; color:#1e293b; font-weight:600; text-align:right; }
    .btn { display:inline-block; background:#7c3aed; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600; margin-top:8px; }
    .footer { background:#f8fafc; padding:16px 32px; text-align:center; }
    .footer-text { font-size:11px; color:#94a3b8; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="header-logo">🧠 Cittaa Mind Bridge</div>
    <div class="header-sub">School Counselling Management Platform</div>
  </div>
  <div class="body">
    <div class="title">${title}</div>
    ${content}
  </div>
  <div class="footer">
    <div class="footer-text">Cittaa Health Services Pvt. Ltd. · This is an automated message · Do not reply</div>
  </div>
</div>
</body>
</html>`
}

// ─── Email helpers ────────────────────────────────────────────────────────────
async function send(to: string | string[], subject: string, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })
    if (error) console.error('[Resend]', error)
    return data
  } catch (err) {
    console.error('[Resend] Failed to send email:', err instanceof Error ? err.message : String(err))
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export async function sendNewRequestEmail(opts: {
  to: string
  recipientName: string
  requestNumber: string
  studentName: string
  concern: string
  priority: string
  schoolName: string
  submittedBy: string
  requestId: string
}) {
  const priorityClass = opts.priority === 'URGENT' ? 'badge-red' : opts.priority === 'HIGH' ? 'badge-orange' : 'badge-blue'
  const content = `
    <p class="text">Hello ${opts.recipientName},</p>
    <p class="text">A new counselling request has been submitted and requires your approval.</p>
    <span class="badge ${priorityClass}">Priority: ${opts.priority}</span>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request No.</span><span class="info-value">${opts.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Student</span><span class="info-value">${opts.studentName}</span></div>
      <div class="info-row"><span class="info-label">Concern</span><span class="info-value">${opts.concern}</span></div>
      <div class="info-row"><span class="info-label">School</span><span class="info-value">${opts.schoolName}</span></div>
      <div class="info-row"><span class="info-label">Submitted By</span><span class="info-value">${opts.submittedBy}</span></div>
    </div>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">Review Request →</a>
  `
  return send(opts.to, `[Action Required] New Counselling Request – ${opts.requestNumber}`,
    baseTemplate(content, 'New Counselling Request'))
}

export async function sendRequestApprovedEmail(opts: {
  to: string
  recipientName: string
  requestNumber: string
  studentName: string
  requestId: string
}) {
  const content = `
    <p class="text">Hello ${opts.recipientName},</p>
    <p class="text">The counselling request <strong>${opts.requestNumber}</strong> for student <strong>${opts.studentName}</strong> has been <strong>approved</strong>. A psychologist will be assigned shortly.</p>
    <span class="badge badge-green">Approved</span>
    <br/>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Request →</a>
  `
  return send(opts.to, `Request Approved – ${opts.requestNumber}`,
    baseTemplate(content, 'Request Approved ✓'))
}

export async function sendRequestRejectedEmail(opts: {
  to: string
  recipientName: string
  requestNumber: string
  studentName: string
  reason: string
  requestId: string
}) {
  const content = `
    <p class="text">Hello ${opts.recipientName},</p>
    <p class="text">The counselling request <strong>${opts.requestNumber}</strong> for student <strong>${opts.studentName}</strong> has been <strong>rejected</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Reason</span><span class="info-value">${opts.reason}</span></div>
    </div>
    <p class="text">If you believe this is incorrect, please contact the school principal directly.</p>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Request →</a>
  `
  return send(opts.to, `Request Rejected – ${opts.requestNumber}`,
    baseTemplate(content, 'Request Rejected'))
}

export async function sendPsychologistAssignedEmail(opts: {
  toTeacher: string
  toPsychologist: string
  teacherName: string
  psychologistName: string
  requestNumber: string
  studentName: string
  schoolName: string
  isSubstitute: boolean
  substituteReason?: string
  requestId: string
}) {
  const subNote = opts.isSubstitute ? `<p class="text"><em>Note: ${opts.psychologistName} has been assigned as a substitute psychologist. Reason: ${opts.substituteReason || 'Primary psychologist unavailable'}</em></p>` : ''
  const teacherContent = `
    <p class="text">Hello ${opts.teacherName},</p>
    <p class="text">A psychologist has been assigned for request <strong>${opts.requestNumber}</strong> (Student: <strong>${opts.studentName}</strong>).</p>
    ${subNote}
    <div class="info-box">
      <div class="info-row"><span class="info-label">Assigned Psychologist</span><span class="info-value">${opts.psychologistName}</span></div>
    </div>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Request →</a>
  `
  const psychContent = `
    <p class="text">Hello ${opts.psychologistName},</p>
    <p class="text">You have been assigned${opts.isSubstitute ? ' (as substitute)' : ''} to a counselling request.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request No.</span><span class="info-value">${opts.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Student</span><span class="info-value">${opts.studentName}</span></div>
      <div class="info-row"><span class="info-label">School</span><span class="info-value">${opts.schoolName}</span></div>
    </div>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View & Schedule Session →</a>
  `
  await Promise.all([
    send(opts.toTeacher,      `Psychologist Assigned – ${opts.requestNumber}`, baseTemplate(teacherContent, 'Psychologist Assigned')),
    send(opts.toPsychologist, `New Assignment – ${opts.requestNumber}`,        baseTemplate(psychContent,   'New Counselling Assignment')),
  ])
}

export async function sendSessionScheduledEmail(opts: {
  to: string
  recipientName: string
  requestNumber: string
  studentName: string
  scheduledAt: string
  psychologistName: string
  requestId: string
}) {
  const content = `
    <p class="text">Hello ${opts.recipientName},</p>
    <p class="text">A counselling session has been scheduled.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request No.</span><span class="info-value">${opts.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Student</span><span class="info-value">${opts.studentName}</span></div>
      <div class="info-row"><span class="info-label">Scheduled At</span><span class="info-value">${opts.scheduledAt}</span></div>
      <div class="info-row"><span class="info-label">Psychologist</span><span class="info-value">${opts.psychologistName}</span></div>
    </div>
    <a href="${APP_URL}/dashboard/requests/${opts.requestId}" class="btn">View Session →</a>
  `
  return send(opts.to, `Session Scheduled – ${opts.requestNumber}`,
    baseTemplate(content, 'Session Scheduled 📅'))
}

export async function sendAssessmentRequestEmail(opts: {
  to: string
  recipientName: string
  requestNumber: string
  studentName: string
  assessmentType: string
  reason: string
  psychologistName: string
  assessmentId: string
}) {
  const content = `
    <p class="text">Hello ${opts.recipientName},</p>
    <p class="text">Psychologist <strong>${opts.psychologistName}</strong> has requested a formal assessment for student <strong>${opts.studentName}</strong>. Your approval is required.</p>
    <span class="badge badge-orange">Pending Approval</span>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request No.</span><span class="info-value">${opts.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Assessment Type</span><span class="info-value">${opts.assessmentType}</span></div>
      <div class="info-row"><span class="info-label">Reason</span><span class="info-value">${opts.reason}</span></div>
    </div>
    <a href="${APP_URL}/dashboard/assessments/${opts.assessmentId}" class="btn">Review & Approve →</a>
  `
  return send(opts.to, `[Action Required] Assessment Request – ${opts.requestNumber}`,
    baseTemplate(content, 'Assessment Approval Required'))
}

export async function sendRCINotificationEmail(opts: {
  to: string
  rciMemberName: string
  requestNumber: string
  studentName: string
  schoolName: string
  schoolAddress: string
  assessmentType: string
  rciReportId: string
}) {
  const content = `
    <p class="text">Hello ${opts.rciMemberName},</p>
    <p class="text">You have been assigned to conduct a school visit for a formal assessment.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request No.</span><span class="info-value">${opts.requestNumber}</span></div>
      <div class="info-row"><span class="info-label">Student</span><span class="info-value">${opts.studentName}</span></div>
      <div class="info-row"><span class="info-label">School</span><span class="info-value">${opts.schoolName}</span></div>
      <div class="info-row"><span class="info-label">School Address</span><span class="info-value">${opts.schoolAddress}</span></div>
      <div class="info-row"><span class="info-label">Assessment Type</span><span class="info-value">${opts.assessmentType}</span></div>
    </div>
    <p class="text">Please log in to confirm your visit date and submit findings after the visit.</p>
    <a href="${APP_URL}/dashboard/rci/${opts.rciReportId}" class="btn">View Assignment →</a>
  `
  return send(opts.to, `RCI Visit Assignment – ${opts.requestNumber}`,
    baseTemplate(content, 'New RCI Visit Assignment 🏫'))
}

export async function sendWelcomeEmail(opts: {
  to: string
  name: string
  role: string
  schoolName?: string
  temporaryPassword: string
  setPasswordUrl?: string   // if provided, user clicks this to set their own password
}) {
  const roleLabel = opts.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const ctaBlock = opts.setPasswordUrl
    ? `<p class="text">Click the button below to set your own password and activate your account. This link is valid for <strong>72 hours</strong>.</p>
       <a href="${opts.setPasswordUrl}" class="btn" style="background:#16a34a;">Set My Password →</a>
       <p class="text" style="margin-top:16px;font-size:12px;color:#94a3b8;">Or use the temporary password above to log in at <a href="${APP_URL}/login" style="color:#a78bfa;">${APP_URL}/login</a> and change it from your profile.</p>`
    : `<p class="text">Please log in and change your password immediately from your profile settings.</p>
       <a href="${APP_URL}/login" class="btn">Log In Now →</a>`

  const content = `
    <p class="text">Hello ${opts.name},</p>
    <p class="text">Welcome to <strong>Cittaa Mind Bridge</strong> — the school counselling management platform. Your account has been set up and is ready to use.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${opts.to}</span></div>
      <div class="info-row"><span class="info-label">Temporary Password</span><span class="info-value" style="font-family:monospace;letter-spacing:1px;">${opts.temporaryPassword}</span></div>
      <div class="info-row"><span class="info-label">Role</span><span class="info-value">${roleLabel}</span></div>
      ${opts.schoolName ? `<div class="info-row"><span class="info-label">School</span><span class="info-value">${opts.schoolName}</span></div>` : ''}
    </div>
    ${ctaBlock}
  `
  return send(opts.to, 'Welcome to Cittaa Mind Bridge — Your Account is Ready',
    baseTemplate(content, 'Welcome to Cittaa Mind Bridge 🧠'))
}

// ─── Error alert email (sent to Cittaa admin on crashes) ──────────────────────
const ALERT_RECIPIENT = process.env.ERROR_ALERT_EMAIL || 'info@cittaa.in'

export async function sendErrorAlertEmail(opts: {
  type:        string
  route:       string
  method?:     string
  message:     string
  stack?:      string
  statusCode?: number
  durationMs?: number
  userId?:     string
  userEmail?:  string
  userRole?:   string
  ipAddress?:  string
}) {
  const typeLabel: Record<string, string> = {
    API_CRASH:      '🔴 API Crash',
    FRONTEND_CRASH: '🟠 Frontend Crash',
    AUTH_FAILURE:   '🟡 Auth Failure',
    SLOW_API:       '🔵 Slow Response',
  }
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const stackSnippet = opts.stack ? opts.stack.split('\n').slice(0, 6).join('\n') : ''

  const content = `
    <p class="text">An error was detected on the Cittaa platform at <strong>${ts} IST</strong>.</p>
    <span class="badge badge-red">${typeLabel[opts.type] ?? opts.type}</span>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Route</span><span class="info-value">${opts.method ?? ''} ${opts.route}</span></div>
      ${opts.statusCode ? `<div class="info-row"><span class="info-label">Status</span><span class="info-value">${opts.statusCode}</span></div>` : ''}
      ${opts.durationMs ? `<div class="info-row"><span class="info-label">Duration</span><span class="info-value">${opts.durationMs}ms</span></div>` : ''}
      ${opts.userEmail  ? `<div class="info-row"><span class="info-label">User</span><span class="info-value">${opts.userEmail} (${opts.userRole ?? ''})</span></div>` : ''}
      ${opts.ipAddress  ? `<div class="info-row"><span class="info-label">IP</span><span class="info-value">${opts.ipAddress}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Message</span><span class="info-value" style="max-width:300px;word-break:break-all;">${opts.message}</span></div>
    </div>
    ${stackSnippet ? `<pre style="background:#1e293b;color:#e2e8f0;padding:14px 16px;border-radius:8px;font-size:11px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${stackSnippet}</pre>` : ''}
    <a href="${APP_URL}/dashboard/errors" class="btn">View Error Log →</a>
  `
  return send(
    ALERT_RECIPIENT,
    `[Cittaa Alert] ${typeLabel[opts.type] ?? opts.type} — ${opts.route}`,
    baseTemplate(content, 'Platform Error Alert')
  )
}

export async function sendPasswordResetEmail(opts: {
  to: string
  name: string
  resetUrl: string
}) {
  const content = `
    <p class="text">Hello ${opts.name},</p>
    <p class="text">We received a request to reset the password for your Cittaa Mind Bridge account.</p>
    <p class="text">Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
    <a href="${opts.resetUrl}" class="btn">Reset My Password →</a>
    <p class="text" style="margin-top:20px;font-size:12px;color:#94a3b8;">
      If you did not request a password reset, please ignore this email. Your password will remain unchanged.
      <br/>If you're concerned, contact us at <a href="mailto:support@cittaa.in" style="color:#a78bfa;">support@cittaa.in</a>.
    </p>
  `
  return send(opts.to, 'Reset Your Cittaa Mind Bridge Password',
    baseTemplate(content, 'Password Reset Request 🔐'))
}
