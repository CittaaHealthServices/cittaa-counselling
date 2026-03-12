import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect authenticated users away from login
    if (pathname === '/login' && token) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Role-based route guards
    if (
      pathname.startsWith('/dashboard/schools') &&
      !['CITTAA_ADMIN', 'CITTAA_SUPPORT'].includes(token?.role as string)
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (
      pathname.startsWith('/dashboard/users') &&
      !['CITTAA_ADMIN', 'CITTAA_SUPPORT', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN'].includes(token?.role as string)
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
          // API routes check auth individually
          if (pathname.startsWith('/api/auth')) return true
          if (pathname.startsWith('/dashboard')) return !!token
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*'],
}
