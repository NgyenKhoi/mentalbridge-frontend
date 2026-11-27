import 'server-only'

import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/api-error'
import {
  CORRELATION_HEADER,
  localProblem,
  problemResponse,
} from '@/lib/auth/bff-response'

export { localProblem }

const titles: Record<string, string> = {
  VALIDATION_FAILED: 'Dữ liệu ghi nhận cảm xúc không hợp lệ.',
  AUTHENTICATION_REQUIRED: 'Bạn cần đăng nhập để ghi nhận cảm xúc.',
  RESOURCE_NOT_FOUND: 'Hôm nay bạn chưa ghi nhận cảm xúc.',
  CONFLICT: 'Ghi nhận này đang được thay đổi ở nơi khác.',
  PRECONDITION_FAILED: 'Ghi nhận này vừa được cập nhật ở nơi khác.',
  DEPENDENCY_UNAVAILABLE: 'Ghi nhận cảm xúc tạm thời chưa khả dụng.',
  EMOTION_CHECK_IN_UNAVAILABLE: 'Ghi nhận cảm xúc tạm thời chưa khả dụng.',
  EMOTION_CHECK_IN_MALFORMED_RESPONSE:
    'Dữ liệu ghi nhận cảm xúc tạm thời chưa tải được.',
  EMOTION_CHECK_IN_MUTATION_OUTCOME_UNKNOWN:
    'Chưa thể xác nhận thay đổi đã được lưu hay chưa.',
}

export function emotionErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) {
    const status = error.status ?? 502
    const code = /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : 'EMOTION_CHECK_IN_UPSTREAM_ERROR'
    return problemResponse({
      type: `/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title:
        titles[code] ??
        (status >= 500
          ? 'Ghi nhận cảm xúc tạm thời chưa khả dụng.'
          : 'Không thể xử lý yêu cầu ghi nhận cảm xúc.'),
      status,
      code,
      correlationId,
    })
  }
  return localProblem(
    502,
    'EMOTION_CHECK_IN_DEPENDENCY_FAILED',
    'Ghi nhận cảm xúc tạm thời chưa khả dụng.',
    correlationId,
  )
}

export function emotionSuccessResponse<T>(
  body: T,
  correlationId: string,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
