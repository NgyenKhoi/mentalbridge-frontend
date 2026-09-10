import { NextRequest, NextResponse } from 'next/server'
import { readSessionCredentials } from '@/lib/auth/session-cookies'
import { resolveSession, ensureRole } from '@/lib/auth/session-service'
import { ApiError } from '@/lib/api/api-error'

const CONTENT_SERVICE_URL =
  process.env.CONTENT_SERVICE_URL || 'http://localhost:3003'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID()
    const { id } = await params
    const { searchParams } = request.nextUrl
    const version = searchParams.get('version')

    // Resolve and validate session
    const credentials = readSessionCredentials(request.cookies)
    const session = await resolveSession(credentials, correlationId)
    ensureRole(session.account, ['ADMIN'])

    if (!version) {
      return NextResponse.json(
        { error: 'version query parameter is required' },
        { status: 400 },
      )
    }

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/${id}/archive?version=${version}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.accessToken}`,
          'x-correlation-id': correlationId,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      )
    }
    console.error('[BFF] Failed to archive resource:', error)
    return NextResponse.json(
      { error: 'Failed to archive resource' },
      { status: 500 },
    )
  }
}
