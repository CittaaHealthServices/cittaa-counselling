import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { Role } from '@/types'
import AuditLog from '@/models/AuditLog'
import { logError } from '@/lib/monitor'

const CITTAA_DOMAIN   = 'cittaa.in'
const CITTAA_ROLES    = ['CITTAA_ADMIN', 'CITTAA_SUPPORT'] as const

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Google (Cittaa employees only — @cittaa.in) ──────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

    // ── Email + Password (all other roles) ───────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const identifier = credentials.email.trim().toLowerCase()
        await connectDB()

        const user = await User.findOne({
          $or: [{ email: identifier }, { username: identifier }],
          isActive: true,
        }).populate('schoolId', 'name code')

        if (!user) {
          logError('AUTH_FAILURE', {
            route:   '/api/auth/signin',
            method:  'POST',
            message: `Login failed — no active user: ${credentials.email.toLowerCase()}`,
            metadata: { email: credentials.email.toLowerCase(), reason: 'USER_NOT_FOUND' },
          }).catch(() => {})
          return null
        }

        const isValid = await user.verifyPassword(credentials.password)
        if (!isValid) {
          logError('AUTH_FAILURE', {
            route:     '/api/auth/signin',
            method:    'POST',
            message:   `Login failed — wrong password for ${user.email}`,
            userId:    user._id.toString(),
            userEmail: user.email,
            userRole:  user.role,
            metadata:  { reason: 'WRONG_PASSWORD' },
          }).catch(() => {})
          return null
        }

        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() })

        try {
          await AuditLog.create({
            userId:    user._id.toString(),
            userEmail: user.email,
            userRole:  user.role,
            action:    'LOGIN',
            resource:  'User',
            resourceId: user._id.toString(),
            schoolId:  user.schoolId?._id?.toString() ?? undefined,
            details:   { name: user.name, method: 'credentials' },
          })
        } catch (err) {
          console.error('[AuditLog] Failed to write LOGIN audit:', err)
        }

        return {
          id:          user._id.toString(),
          name:        user.name,
          email:       user.email,
          role:        user.role,
          schoolId:    user.schoolId?._id?.toString() ?? null,
          schoolName:  (user.schoolId as any)?.name ?? null,
          isAvailable: user.isAvailable,
        }
      },
    }),
  ],

  callbacks: {
    // ── Gate Google sign-ins to @cittaa.in domain ────────────────────────────
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase() ?? ''

        // 1. Domain check
        if (!email.endsWith(`@${CITTAA_DOMAIN}`)) {
          console.warn(`[Auth] Google sign-in blocked — non-cittaa email: ${email}`)
          return '/login?error=DomainNotAllowed'
        }

        // 2. Must have an active CITTAA_ADMIN or CITTAA_SUPPORT account in DB
        try {
          await connectDB()
          const dbUser = await User.findOne({
            email,
            isActive: true,
            role: { $in: CITTAA_ROLES },
          })
          if (!dbUser) {
            console.warn(`[Auth] Google sign-in blocked — no Cittaa staff account for: ${email}`)
            return '/login?error=AccountNotFound'
          }
        } catch (err) {
          console.error('[Auth] Google signIn DB check failed:', err)
          return '/login?error=ServerError'
        }

        return true
      }

      // Credentials provider: always allowed here (authorized() handles rejection)
      return true
    },

    // ── Enrich JWT with Cittaa-specific fields ───────────────────────────────
    async jwt({ token, user, account }) {
      // Credentials sign-in — user object already has all fields
      if (account?.provider === 'credentials' && user) {
        token.id          = user.id
        token.role        = (user as any).role
        token.schoolId    = (user as any).schoolId
        token.schoolName  = (user as any).schoolName
        token.isAvailable = (user as any).isAvailable
        return token
      }

      // Google sign-in — load role/profile from DB
      if (account?.provider === 'google' && user?.email) {
        try {
          await connectDB()
          const dbUser = await User.findOne({
            email:    user.email.toLowerCase(),
            isActive: true,
          }).populate('schoolId', 'name code')

          if (dbUser) {
            token.id          = dbUser._id.toString()
            token.role        = dbUser.role
            token.schoolId    = dbUser.schoolId?._id?.toString() ?? null
            token.schoolName  = (dbUser.schoolId as any)?.name   ?? null
            token.isAvailable = dbUser.isAvailable

            // Update last login + audit
            await User.findByIdAndUpdate(dbUser._id, { lastLogin: new Date() })
            await AuditLog.create({
              userId:    dbUser._id.toString(),
              userEmail: dbUser.email,
              userRole:  dbUser.role,
              action:    'LOGIN',
              resource:  'User',
              resourceId: dbUser._id.toString(),
              details:   { name: dbUser.name, method: 'google' },
            }).catch(() => {})
          }
        } catch (err) {
          console.error('[Auth] JWT Google DB lookup failed:', err)
        }
        return token
      }

      // Subsequent requests — token already populated
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id          = token.id          as string
        session.user.role        = token.role        as Role
        session.user.schoolId    = token.schoolId    as string | null
        session.user.schoolName  = token.schoolName  as string | null
        session.user.isAvailable = token.isAvailable as boolean
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge:   24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// ── Type augmentation ──────────────────────────────────────────────────────────
declare module 'next-auth' {
  interface Session {
    user: {
      id:          string
      name:        string
      email:       string
      role:        Role
      schoolId:    string | null
      schoolName:  string | null
      isAvailable: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:          string
    role:        Role
    schoolId:    string | null
    schoolName:  string | null
    isAvailable: boolean
  }
}
