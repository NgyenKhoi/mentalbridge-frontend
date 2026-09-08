import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CONTENT_SERVICE_URL =
  process.env.CONTENT_NOTIFICATION_SERVICE_URL || 'http://localhost:3003'

const UpdateResourceSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().min(1).optional(),
  contentBody: z.string().nullish(),
  externalUrl: z.string().nullish(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
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
    console.error('[BFF] Failed to get resource:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resource' },
      { status: 500 },
    )
  }
}

export async function PATCH(
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

    const body = await request.json()
    const validated = UpdateResourceSchema.parse(body)

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/${id}?version=${version}`,
      {
        method: 'PATCH',
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

    console.error('[BFF] Failed to update resource:', error)
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/${id}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(errorData, { status: response.status })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[BFF] Failed to delete resource:', error)
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 },
    )
  }
}
