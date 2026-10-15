import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { FOLLOW_UP_PREVIEW } from '@/features/appointments/mocks/follow-up-preview'
import { isSpecialistMockEnabled } from '@/lib/mock/specialist-mock-service'

export function GET(request: NextRequest) {
  const response = isSpecialistMockEnabled(request)
    ? { enabled: true, board: FOLLOW_UP_PREVIEW }
    : { enabled: false }

  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
