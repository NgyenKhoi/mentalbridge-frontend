import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import { localProblem, problemResponse } from '@/lib/auth/bff-response'

export { localProblem }
export { emotionSuccessResponse as companionSuccessResponse } from '@/lib/emotion-check-in/bff-response'

const titles: Record<string, string> = {
  VALIDATION_FAILED: 'Dữ liệu gửi cho Mầm không hợp lệ.',
  AUTHENTICATION_REQUIRED: 'Bạn cần đăng nhập để trò chuyện với Mầm.',
  RESOURCE_NOT_FOUND: 'Mầm không tìm thấy lời hẹn này.',
  CONFLICT: 'Thay đổi này đang được cập nhật ở nơi khác.',
  COMMITMENT_LIMIT: 'Bạn đang có 3 lời hẹn rồi.',
  COMMITMENT_RESOLVED: 'Lời hẹn này đã được trả lời rồi.',
  DEPENDENCY_UNAVAILABLE: 'Mầm tạm thời chưa khả dụng.',
  COMPANION_STATE_UNAVAILABLE: 'Mầm tạm thời chưa khả dụng.',
  COMPANION_STATE_MALFORMED_RESPONSE: 'Dữ liệu của Mầm tạm thời chưa tải được.',
  COMPANION_STATE_MUTATION_OUTCOME_UNKNOWN:
    'Chưa thể xác nhận thay đổi đã được lưu hay chưa.',
}

/** Upstream error codes (including 409 COMMITMENT_LIMIT / COMMITMENT_RESOLVED) pass through; the text is ours. */
export function companionErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) {
    const status = error.status ?? 502
    const code = /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : 'COMPANION_STATE_UPSTREAM_ERROR'
    return problemResponse({
      type: `/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title:
        titles[code] ??
        (status >= 500
          ? 'Mầm tạm thời chưa khả dụng.'
          : 'Không thể xử lý yêu cầu này.'),
      status,
      code,
      correlationId,
    })
  }
  return localProblem(
    502,
    'COMPANION_STATE_DEPENDENCY_FAILED',
    'Mầm tạm thời chưa khả dụng.',
    correlationId,
  )
}
