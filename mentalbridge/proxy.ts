import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/auth/session-cookies'

export function proxy(request: NextRequest) {
  const hasSessionHint =
    request.cookies.has(ACCESS_COOKIE_NAME) ||
    request.cookies.has(REFRESH_COOKIE_NAME)

  if (hasSessionHint) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  )
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/journal/:path*',
    '/assessments/:path*',
    '/specialists/:path*',
    '/appointments/:path*',
    '/messages/:path*',
    '/resources/:path*',
    '/analytics/:path*',
    '/subscription/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/specialist/:path*',
  ],
}
