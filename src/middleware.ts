import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight middleware — only checks that a session cookie EXISTS before
 * allowing access to /dashboard routes.
 *
 * We intentionally do NOT verify the JWT here (no withAuth / no NEXTAUTH_SECRET
 * needed on the Edge). Actual token validation happens inside each API route
 * via getServerSession(). This avoids the Edge-JWT-verification loop that
 * caused the login redirect to keep failing.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  // Next-Auth sets one of these two cookie names depending on HTTPS
  const hasSession =
    req.cookies.has('next-auth.session-token') ||
    req.cookies.has('__Secure-next-auth.session-token')

  if (!hasSession) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
