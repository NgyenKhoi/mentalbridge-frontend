import type { NextRequest } from 'next/server'

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    const host = request.headers.get('host') ?? request.nextUrl.host
    return (
      origin === parsed.origin &&
      parsed.host === host.toLowerCase() &&
      parsed.protocol === request.nextUrl.protocol
    )
  } catch {
    return false
  }
}
