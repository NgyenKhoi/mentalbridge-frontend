import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readSessionCredentials } from '@/lib/auth/session-cookies'
import { resolveSession, ensureRole } from '@/lib/auth/session-service'
import { ApiError } from '@/lib/api/api-error'

const CONTENT_SERVICE_URL =
  process.env.CONTENT_SERVICE_URL || 'http://localhost:3003'

const CreateResourceSchema = z.object({
  category: z.enum([
    'BREATHING',
    'MEDITATION',
    'ARTICLE',
    'VIDEO',
    'JOURNALING',
    'COMMUNITY',
  ]),
  locale: z.string().default('vi-VN'),
  title: z.string().min(1).max(255),
  summary: z.string().min(1),
  contentBody: z.string().nullish(),
  externalUrl: z.string().nullish(),
})

export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID()
    
    // Resolve and validate session
    const credentials = readSessionCredentials(request.cookies)
    const session = await resolveSession(credentials, correlationId)
    ensureRole(session.account, ['ADMIN'])

    const { searchParams } = request.nextUrl
    const locale = searchParams.get('locale')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const limit = searchParams.get('limit')
    const cursor = searchParams.get('cursor')

    const params = new URLSearchParams()
    if (locale) params.append('locale', locale)
    if (category) params.append('category', category)
    if (status) params.append('status', status)
    if (limit) params.append('limit', limit)
    if (cursor) params.append('cursor', cursor)

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/admin/list?${params}`,
      {
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
    console.error('[BFF] Failed to list admin resources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID()
    
    // Resolve and validate session
    const credentials = readSessionCredentials(request.cookies)
    const session = await resolveSession(credentials, correlationId)
    ensureRole(session.account, ['ADMIN'])

    const body = await request.json()
    const validated = CreateResourceSchema.parse(body)

    const { searchParams } = request.nextUrl
    const idempotencyKey = searchParams.get('idempotencyKey')

    const url = new URL(`${CONTENT_SERVICE_URL}/api/v1/resources`)
    if (idempotencyKey) url.searchParams.append('idempotencyKey', idempotencyKey)

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.accessToken}`,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(validated),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      )
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://mentalbridge.io/errors/VALIDATION_ERROR',
          title: 'Validation failed',
          status: 422,
          code: 'VALIDATION_ERROR',
          fieldViolations: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 422 },
      )
    }

    console.error('[BFF] Failed to create resource:', error)
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 },
    )
  }
}
