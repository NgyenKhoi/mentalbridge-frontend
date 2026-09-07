import type { NextRequest } from 'next/server'

import { correlationIdFrom, successResponse } from '@/lib/auth/bff-response'
import { listReviewedResources } from '@/lib/content/content-client'

const unavailable = {
  data: [],
  count: 0,
  fallback: 'unavailable' as const,
  message: 'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
}

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  try {
    return successResponse(
      await listReviewedResources(correlationId),
      correlationId,
    )
  } catch {
    return successResponse(unavailable, correlationId)
  }
}
