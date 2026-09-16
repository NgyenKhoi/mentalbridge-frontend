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
  VALIDATION_FAILED: 'Dữ liệu cảm xúc chưa hợp lệ.',
  RESOURCE_NOT_FOUND: 'Chưa có ghi nhận cảm xúc cho ngày này.',
  CONFLICT: 'Ngày này đã có thay đổi khác. Hãy tải lại trước khi lưu.',
  PRECONDITION_FAILED: 'Ghi nhận đã được cập nhật ở nơi khác.',
  DEPENDENCY_UNAVAILABLE: 'Dịch vụ ghi nhận cảm xúc tạm thời không khả dụng.',
  EMOTION_CHECK_IN_UNAVAILABLE:
    'Dịch vụ ghi nhận cảm xúc tạm thời không khả dụng.',
  EMOTION_CHECK_IN_MALFORMED_RESPONSE:
    'Dịch vụ ghi nhận cảm xúc trả về dữ liệu không hợp lệ.',
  EMOTION_CHECK_IN_MUTATION_OUTCOME_UNKNOWN:
    'Chưa thể xác nhận thao tác lưu đã hoàn tất hay chưa.',
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
          ? 'Dịch vụ ghi nhận cảm xúc gặp lỗi.'
          : 'Yêu cầu ghi nhận cảm xúc bị từ chối.'),
      status,
      code,
      correlationId,
    })
  }
  return localProblem(
    502,
    'EMOTION_CHECK_IN_DEPENDENCY_FAILED',
    'Dịch vụ ghi nhận cảm xúc gặp lỗi.',
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
