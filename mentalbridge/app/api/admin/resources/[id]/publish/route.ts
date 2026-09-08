import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CONTENT_SERVICE_URL =
  process.env.CONTENT_NOTIFICATION_SERVICE_URL || 'http://localhost:3003'

const PublishResourceSchema = z.object({
  effectiveAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = request.nextUrl
    const version = searchParams.get('version')

    if (!version) {
      return NextResponse.json(
        { error: 'version query parameter is required' },
        { status: 400 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const validated = PublishResourceSchema.parse(body)

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/${id}/publish?version=${version}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validated),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
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

    console.error('[BFF] Failed to publish resource:', error)
    return NextResponse.json(
      { error: 'Failed to publish resource' },
      { status: 500 },
    )
  }
}
