import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect already-authenticated users away from /login
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Allow the request through only when there is a valid token for /dashboard paths.
      // All other paths (login, forgot-password, reset-password, api/auth) are public.
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        if (pathname.startsWith('/dashboard')) return !!token
        return true
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
  ],
}
