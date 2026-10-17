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
  AI_CONSENT_REQUIRED:
    'Bạn cần bật đồng ý xử lý AI trước khi dùng AI Companion.',
  CHAT_QUOTA_EXHAUSTED: 'Bạn đã dùng hết lượt trả lời của kỳ hôm nay.',
  CHAT_RATE_LIMITED: 'Bạn đang gửi quá nhanh. Vui lòng chờ một chút.',
  CHAT_TOKEN_BUDGET_EXHAUSTED:
    'Giới hạn sử dụng an toàn hôm nay đã đạt mức tối đa.',
  CHAT_PROVIDER_UNAVAILABLE:
    'AI Companion tạm thời chưa thể trả lời. Nội dung chăm sóc và trợ giúp khẩn cấp vẫn hoạt động.',
  CHAT_CONTEXT_UNAVAILABLE:
    'Chưa thể xác minh bối cảnh được phép. Không có dữ liệu nhạy cảm nào được gửi tới AI.',
  REMINDER_CONTEXT_UNAVAILABLE:
    'Bối cảnh nhắc nhở chưa được hỗ trợ trong phiên bản này.',
  IDEMPOTENCY_KEY_REUSED: 'Yêu cầu gửi lại không khớp với nội dung ban đầu.',
  RESOURCE_NOT_FOUND: 'Không tìm thấy cuộc trò chuyện này.',
  COMPANION_UNAVAILABLE: 'AI Companion tạm thời không khả dụng.',
  COMPANION_MALFORMED_RESPONSE:
    'AI Companion trả về dữ liệu không hợp lệ và đã bị chặn.',
}

export function companionErrorResponse(error: unknown, correlationId: string) {
  if (error instanceof ApiError) {
    const status = error.status ?? 502
    const code = /^[A-Z0-9_]{1,96}$/.test(error.code)
      ? error.code
      : 'COMPANION_UPSTREAM_ERROR'
    return problemResponse({
      type: `/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title:
        titles[code] ??
        (status >= 500
          ? 'AI Companion tạm thời không khả dụng.'
          : 'Yêu cầu AI Companion bị từ chối.'),
      status,
      code,
      correlationId,
    })
  }
  return localProblem(
    502,
    'COMPANION_DEPENDENCY_FAILED',
    'AI Companion tạm thời không khả dụng.',
    correlationId,
  )
}

export function companionSuccessResponse<T>(
  body: T,
  correlationId: string,
  status = 200,
) {
  const response = NextResponse.json(body, { status })
  response.headers.set(CORRELATION_HEADER, correlationId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
