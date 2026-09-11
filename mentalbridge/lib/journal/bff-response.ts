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
  VALIDATION_FAILED: 'Dữ liệu nhật ký không hợp lệ.',
  AUTHENTICATION_REQUIRED: 'Bạn cần đăng nhập để xem nhật ký.',
  RESOURCE_NOT_FOUND: 'Không tìm thấy nhật ký.',
  CONFLICT: 'Yêu cầu này xung đột với dữ liệu hiện tại.',
  PRECONDITION_FAILED: 'Nhật ký đã được cập nhật ở nơi khác.',
  JOURNAL_UNAVAILABLE: 'Dịch vụ nhật ký hiện không khả dụng.',
  JOURNAL_MALFORMED_RESPONSE: 'Dịch vụ nhật ký trả về dữ liệu không hợp lệ.',
  JOURNAL_MUTATION_OUTCOME_UNKNOWN:
    'Chưa thể xác nhận thao tác đã hoàn tất hay chưa.',
}

export function journalErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) {
    const status = error.status ?? 502
    const code = /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : 'JOURNAL_UPSTREAM_ERROR'
    return problemResponse({
      type: `/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title:
        titles[code] ??
        (status >= 500
          ? 'Dịch vụ nhật ký gặp lỗi.'
          : 'Yêu cầu nhật ký bị từ chối.'),
      status,
      code,
      correlationId,
    })
  }
  return localProblem(
    502,
    'JOURNAL_DEPENDENCY_FAILED',
    'Dịch vụ nhật ký gặp lỗi.',
    correlationId,
  )
}

export function journalSuccessResponse<T>(
  body: T,
  correlationId: string,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
