'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react'

// Topics from the MindBridge template — grouped by theme for the dropdown
const TEMPLATE_TOPICS: { theme: string; title: string; targetGroup: string; programType: string; mode: string; seriesType: string; priority: string }[] = [
  // SEL
  { theme: 'SEL', title: "Feelings are Friends: Happy, Sad, Angry, Scared", targetGroup: "Nursery–UKG", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  { theme: 'SEL', title: "Emotion Vocabulary: 30 Feelings Every Child Should Know", targetGroup: "Grade 1–2", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  { theme: 'SEL', title: "Growth Mindset: Yet is a Superpower", targetGroup: "Grade 3–5", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  { theme: 'SEL', title: "Identity & Belonging: Who Am I in Middle School?", targetGroup: "Grade 6–7", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  { theme: 'SEL', title: "'Who Am I?' – Identity, Strengths & Building Classroom Community", targetGroup: "Grade 6–8", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  // Academic Stress
  { theme: 'Academic Stress', title: "Board Exam Stress: Survive & Thrive", targetGroup: "Grade 11–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Academic Stress', title: "CUET / JEE / NEET Stress & the Indian Parenting Pressure Trap", targetGroup: "Grade 11–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Academic Stress', title: "Pre-Board Season: Exam Phobia, Perfectionism & Fear of Failure", targetGroup: "Grade 8–10", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Academic Stress', title: "Stress, Homework & the Overwhelm Cycle – Practical Tools", targetGroup: "Grade 6–8", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "MEDIUM" },
  // Cyber Safety
  { theme: 'Cyber Safety', title: "Cyberbullying: When the Playground Goes Online", targetGroup: "Grade 6–8", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Cyber Safety', title: "Social Media Addiction: The Dopamine Loop & How to Beat It", targetGroup: "Grade 6–10", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Cyber Safety', title: "Cybersecurity Masterclass – Phishing, Privacy, Passwords & Online Predators", targetGroup: "Grade 8–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'AI & Digital', title: "AI Tools: Friend, Foe or Addiction? – ChatGPT, Reels & Your Brain", targetGroup: "Grade 8–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'AI & Digital', title: "Fake News, Deepfakes & AI Manipulation – How to Be AI-Literate", targetGroup: "Grade 6–8", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  // POCSO
  { theme: 'POCSO', title: "My Body is Mine: Good Touch / Bad Touch (POCSO – Age 3+)", targetGroup: "Nursery–UKG", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "QUARTERLY", priority: "HIGH" },
  { theme: 'POCSO', title: "Good Touch / Bad Touch: Detailed POCSO (Age 8+)", targetGroup: "Grade 3–5", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "QUARTERLY", priority: "HIGH" },
  { theme: 'POCSO', title: "Sexual Harassment at School: Understanding POSH for Students", targetGroup: "Grade 8–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  // Sexual Health
  { theme: 'Sexual Health', title: "Dating Apps, Relationships & Consent: What No One Told You", targetGroup: "Grade 9–12", programType: "CLASSROOM_WORKSHOP", mode: "ONLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Sexual Health', title: "Pornography, Consent & Distorted Reality – Evidence-Based Psychoeducation", targetGroup: "Grade 8–10", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Relationships', title: "Relationship Red Flags: Healthy vs Toxic", targetGroup: "Grade 11–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  // Crisis Prevention
  { theme: 'Crisis Prevention', title: "Suicide Prevention Month: 'It's Okay to Not Be Okay'", targetGroup: "Grade 9–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "ONE_TIME", priority: "HIGH" },
  { theme: 'Crisis Prevention', title: "Self-Harm Awareness: Understanding the Pain Behind the Behaviour", targetGroup: "Grade 6–8", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Crisis Prevention', title: "Healthy Coping vs Self-Destruction: Building Your Personal Toolkit", targetGroup: "Grade 8–10", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  // Substance
  { theme: 'Substance Prevention', title: "Substance Use in Indian Schools: Alcohol, Tobacco, Vaping & Peer Pressure", targetGroup: "Grade 9–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  // Wellness
  { theme: 'Wellness', title: "Mindfulness for Kids: Breathing, Grounding & Being Present", targetGroup: "Grade 3–5", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  { theme: 'Wellness', title: "Summer Mental Health Reset: Journaling, Gratitude & Digital Detox", targetGroup: "Grade 9–12", programType: "CLASSROOM_WORKSHOP", mode: "ONLINE", seriesType: "MONTHLY_SERIES", priority: "MEDIUM" },
  // Career
  { theme: 'Career & Identity', title: "Career Confusion After 12th: The Pressure of Stream & Society", targetGroup: "Grade 11–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Career & Identity', title: "Life After School: College Transitions, Independence & Mental Health", targetGroup: "Grade 11–12", programType: "CLASSROOM_WORKSHOP", mode: "OFFLINE", seriesType: "ONE_TIME", priority: "HIGH" },
  // Teacher Training
  { theme: 'Teacher Development', title: "Understanding the Mental Health Landscape: What Indian Schools Are Facing Today", targetGroup: "All Teaching Staff", programType: "TEACHER_TRAINING", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Teacher Development', title: "Spotting Early Signs: Emotional Distress vs Normal Childhood Behaviour", targetGroup: "Class Teachers Gr 1–5", programType: "TEACHER_TRAINING", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Teacher Development', title: "Suicide Risk Assessment: QPR Training for Teachers", targetGroup: "All Teachers", programType: "TEACHER_TRAINING", mode: "OFFLINE", seriesType: "ONE_TIME", priority: "HIGH" },
  { theme: 'Teacher Development', title: "Teacher Burnout & Self-Care: You Cannot Pour from an Empty Cup", targetGroup: "All Staff", programType: "TEACHER_TRAINING", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  // Parent
  { theme: 'Parent Education', title: "Parent Orientation: What Is Your Child Facing? Intro to Modern Stressors", targetGroup: "All Parents", programType: "PARENT_WORKSHOP", mode: "ONLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Parent Education', title: "Board Exam Parenting: How Your Reaction Shapes Their Result", targetGroup: "Grade 10 & 12 Parents", programType: "PARENT_WORKSHOP", mode: "ONLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Parent Education', title: "Screen Time, Gaming & Social Media: Practical Boundaries for Indian Homes", targetGroup: "All Parents", programType: "PARENT_WORKSHOP", mode: "ONLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  { theme: 'Parent Education', title: "When Your Child Says 'I Want to Die': How to Respond & Seek Help", targetGroup: "All Parents", programType: "PARENT_WORKSHOP", mode: "OFFLINE", seriesType: "MONTHLY_SERIES", priority: "HIGH" },
  // Peer
  { theme: 'Peer Program', title: "Peer Wellbeing Champion Selection & Training – Session 1", targetGroup: "Grade 9–11", programType: "PEER_PROGRAM", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Peer Program', title: "Peer Champions: How to Handle a Friend in Crisis (Role Play)", targetGroup: "Grade 9–11", programType: "PEER_PROGRAM", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
  { theme: 'Peer Program', title: "Peer Champions Board Season Buddy Deployment", targetGroup: "Grade 9–11", programType: "PEER_PROGRAM", mode: "OFFLINE", seriesType: "BI_WEEKLY", priority: "HIGH" },
]

const THEMES = Array.from(new Set(TEMPLATE_TOPICS.map(t => t.theme))).sort()

export default function NewWorkshopPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [useTemplate, setUseTemplate] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [themeFilter, setThemeFilter] = useState('ALL')

  const [form, setForm] = useState({
    title: '', programType: 'CLASSROOM_WORKSHOP', theme: '', targetGroup: '',
    gradeRange: '', plannedDate: '', month: '', week: '',
    mode: 'OFFLINE', durationMinutes: '45', seriesType: 'ONE_TIME',
    priority: 'MEDIUM', conductedById: '', materialPreparedBy: '',
    plannedAttendance: '', comments: '', isFromTemplate: false,
  })

  const role = session?.user?.role || ''

  function applyTemplate(title: string) {
    const t = TEMPLATE_TOPICS.find(x => x.title === title)
    if (!t) return
    setForm(f => ({
      ...f,
      title:       t.title,
      programType: t.programType,
      theme:       t.theme,
      targetGroup: t.targetGroup,
      mode:        t.mode,
      seriesType:  t.seriesType,
      priority:    t.priority,
      isFromTemplate: true,
    }))
  }

  const set = (k: string, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.theme || !form.targetGroup) {
      setError('Title, theme and target group are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          week:             form.week ? parseInt(form.week) : undefined,
          durationMinutes:  parseInt(form.durationMinutes) || 45,
          plannedAttendance: form.plannedAttendance ? parseInt(form.plannedAttendance) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save workshop.')
        return
      }
      const data = await res.json()
      router.push(`/dashboard/workshops/${data.workshop._id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredTemplates = themeFilter === 'ALL'
    ? TEMPLATE_TOPICS
    : TEMPLATE_TOPICS.filter(t => t.theme === themeFilter)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/workshops" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Schedule New Workshop</h1>
          <p className="text-slate-500 text-sm">Choose from the MindBridge template or create custom</p>
        </div>
      </div>

      {/* Template toggle */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen size={18} className="text-purple-600" />
          <span className="font-semibold text-purple-900 text-sm">MindBridge™ Topic Bank</span>
          <span className="text-xs text-purple-500">{TEMPLATE_TOPICS.length} pre-built topics</span>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={themeFilter}
            onChange={e => setThemeFilter(e.target.value)}
            className="text-sm border border-purple-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          >
            <option value="ALL">All Themes</option>
            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={selectedTemplate}
            onChange={e => { setSelectedTemplate(e.target.value); applyTemplate(e.target.value) }}
            className="flex-1 text-sm border border-purple-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          >
            <option value="">— Select a topic to pre-fill the form —</option>
            {filteredTemplates.map(t => (
              <option key={t.title} value={t.title}>{t.title} ({t.targetGroup})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-sm">
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Workshop Title *</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
            placeholder="e.g. Cyberbullying: When the Playground Goes Online"
            className="input w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Program Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Program Type *</label>
            <select value={form.programType} onChange={e => set('programType', e.target.value)} className="input w-full">
              <option value="CLASSROOM_WORKSHOP">Classroom Workshop</option>
              <option value="GROUP_COUNSELLING">Group Counselling</option>
              <option value="TEACHER_TRAINING">Teacher Training</option>
              <option value="PEER_PROGRAM">Peer Program</option>
              <option value="PARENT_WORKSHOP">Parent Workshop</option>
              <option value="ORIENTATION">Orientation</option>
            </select>
          </div>
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Theme *</label>
            <input
              value={form.theme}
              onChange={e => set('theme', e.target.value)}
              required
              list="themes-list"
              placeholder="e.g. SEL, Academic Stress, Cyber Safety"
              className="input w-full"
            />
            <datalist id="themes-list">
              {THEMES.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Target Group */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Group *</label>
            <input
              value={form.targetGroup}
              onChange={e => set('targetGroup', e.target.value)}
              required
              placeholder="e.g. Grade 9–12, All Parents"
              className="input w-full"
            />
          </div>
          {/* Grade Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Grade Range</label>
            <input
              value={form.gradeRange}
              onChange={e => set('gradeRange', e.target.value)}
              placeholder="e.g. Grade 6–8"
              className="input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Planned Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Planned Date</label>
            <input type="date" value={form.plannedDate} onChange={e => set('plannedDate', e.target.value)} className="input w-full" />
          </div>
          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
            <select value={form.mode} onChange={e => set('mode', e.target.value)} className="input w-full">
              <option value="OFFLINE">Offline</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (mins)</label>
            <input
              type="number" min="15" max="180" value={form.durationMinutes}
              onChange={e => set('durationMinutes', e.target.value)}
              className="input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Series Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Series Type</label>
            <select value={form.seriesType} onChange={e => set('seriesType', e.target.value)} className="input w-full">
              <option value="ONE_TIME">One-Time</option>
              <option value="MONTHLY_SERIES">Monthly Series</option>
              <option value="BI_WEEKLY">Bi-Weekly</option>
              <option value="QUARTERLY">Quarterly</option>
            </select>
          </div>
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="input w-full">
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          {/* Planned Attendance */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Expected Attendance</label>
            <input
              type="number" min="1" value={form.plannedAttendance}
              onChange={e => set('plannedAttendance', e.target.value)}
              placeholder="e.g. 30"
              className="input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Material Prepared By */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Material Prepared By</label>
            <input
              value={form.materialPreparedBy}
              onChange={e => set('materialPreparedBy', e.target.value)}
              placeholder="e.g. Khushi Chatterjee"
              className="input w-full"
            />
          </div>
          {/* Month */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Calendar Month</label>
            <input
              value={form.month}
              onChange={e => set('month', e.target.value)}
              placeholder="e.g. Apr 2026"
              className="input w-full"
            />
          </div>
        </div>

        {/* Comments */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Comments / Notes</label>
          <textarea
            value={form.comments}
            onChange={e => set('comments', e.target.value)}
            rows={3}
            placeholder="Any special instructions, room setup, resources needed…"
            className="input w-full resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/workshops" className="btn-secondary flex-1 text-center">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Schedule Workshop'}
          </button>
        </div>
      </form>
    </div>
  )
}
