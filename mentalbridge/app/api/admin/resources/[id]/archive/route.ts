import { NextRequest, NextResponse } from 'next/server'

const CONTENT_SERVICE_URL =
  process.env.CONTENT_NOTIFICATION_SERVICE_URL || 'http://localhost:3003'

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

    const response = await fetch(
      `${CONTENT_SERVICE_URL}/api/v1/resources/${id}/archive?version=${version}`,
      {
        method: 'POST',
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
    console.error('[BFF] Failed to archive resource:', error)
    return NextResponse.json(
      { error: 'Failed to archive resource' },
      { status: 500 },
    )
  }
}
