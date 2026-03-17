import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Only runs on /dashboard/* — login page is NOT in the matcher
    // so no redirect loop is possible between middleware and /login
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect every dashboard route — unauthenticated → NextAuth
        // will redirect to /login?callbackUrl=... automatically
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token
        }
        return true
      },
    },
    pages: { signIn: '/login' },
  }
)

export const config = {
  // ONLY match dashboard routes — do NOT include /login
  // If /login is in the matcher, withAuth can create a redirect loop:
  //   middleware blocks /dashboard → redirects to /login
  //   client session fires → redirects back to /dashboard
  //   middleware blocks again → back to /login → infinite blink
  matcher: ['/dashboard/:path*'],
}
