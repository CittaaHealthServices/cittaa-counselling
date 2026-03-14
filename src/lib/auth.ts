import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { Role } from '@/types'
import AuditLog from '@/models/AuditLog'
import { logError } from '@/lib/monitor'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        await connectDB()

        const user = await User.findOne({
          email: credentials.email.toLowerCase(),
          isActive: true,
        }).populate('schoolId', 'name code')

        if (!user) {
          // Log unknown-email attempt (don't expose which emails exist)
          logError('AUTH_FAILURE', {
            route:   '/api/auth/signin',
            method:  'POST',
            message: `Login failed — no active user found for email: ${credentials.email.toLowerCase()}`,
            metadata: { email: credentials.email.toLowerCase(), reason: 'USER_NOT_FOUND' },
          }).catch(() => {})
          return null
        }

        const isValid = await user.verifyPassword(credentials.password)
        if (!isValid) {
          // Log wrong-password attempt with user context
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

        // Update last login
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() })

        // Audit: record login event as tamper-evident proof
        try {
          await AuditLog.create({
            userId:    user._id.toString(),
            userEmail: user.email,
            userRole:  user.role,
            action:    'LOGIN',
            resource:  'User',
            resourceId: user._id.toString(),
            schoolId:  user.schoolId?._id?.toString() ?? undefined,
            details:   { name: user.name },
          })
        } catch (err) {
          console.error('[AuditLog] Failed to write LOGIN audit:', err)
        }

        return {
          id:       user._id.toString(),
          name:     user.name,
          email:    user.email,
          role:     user.role,
          schoolId: user.schoolId?._id?.toString() ?? null,
          schoolName: (user.schoolId as any)?.name ?? null,
          isAvailable: user.isAvailable,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = user.id
        token.role        = (user as any).role
        token.schoolId    = (user as any).schoolId
        token.schoolName  = (user as any).schoolName
        token.isAvailable = (user as any).isAvailable
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id          = token.id as string
        session.user.role        = token.role as Role
        session.user.schoolId    = token.schoolId as string | null
        session.user.schoolName  = token.schoolName as string | null
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

// ─── Type augmentation ────────────────────────────────────────────────────────
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: Role
      schoolId: string | null
      schoolName: string | null
      isAvailable: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    schoolId: string | null
    schoolName: string | null
    isAvailable: boolean
  }
}
