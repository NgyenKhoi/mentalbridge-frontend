import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'

import type {
  AnonymousAssessment,
  Assessment,
  AssessmentSubmissionRequest,
  Questionnaire,
  PrivacyDisclosure,
  ConsentCollection,
  ConsentDecision,
  CareProfile,
  CareProfileUpdate,
  AssessmentHistoryPage,
  AssessmentProgress,
  Instrument,
} from './care-contract'

export type AssessmentMode = 'anonymous' | 'authenticated'
export type AssessmentView = Assessment | AnonymousAssessment

export async function getCurrentQuestionnaire(instrument: Instrument) {
  const response = await browserApiClient.get<Questionnaire>(
    `/care/questionnaires/${instrument.toLowerCase()}`,
  )
  return response.data
}

export async function getQuestionnaireDefinition(definitionId: string) {
  const response = await browserApiClient.get<Questionnaire>(
    `/care/questionnaires/definitions/${encodeURIComponent(definitionId)}`,
  )
  return response.data
}

export async function getPrivacyDisclosure() {
  return (
    await browserApiClient.get<PrivacyDisclosure>('/care/privacy-disclosure')
  ).data
}

export async function getCareProfile() {
  return (await browserApiClient.get<CareProfile>('/care/profile')).data
}

export async function saveCareProfile(
  update: CareProfileUpdate,
  version?: number,
) {
  return (
    await browserApiClient.put<CareProfile>('/care/profile', update, {
      headers: version === undefined ? {} : { 'If-Match': `"${version}"` },
    })
  ).data
}

export async function getCurrentConsents() {
  return (await browserApiClient.get<ConsentCollection>('/care/consents')).data
}

export async function recordPrivacyDecision(granted: boolean, version: string) {
  return (
    await browserApiClient.post<ConsentDecision>(
      '/care/consent-decisions',
      {
        consentType: 'PRIVACY_POLICY',
        policyVersion: version,
        granted,
      },
      { headers: { 'Idempotency-Key': crypto.randomUUID() } },
    )
  ).data
}

export async function getAssessmentHistory(cursor?: string) {
  return (
    await browserApiClient.get<AssessmentHistoryPage>(
      '/care/assessments/history',
      {
        params: { limit: 10, ...(cursor ? { cursor } : {}) },
      },
    )
  ).data
}

export async function getAssessmentProgress(assessmentId: string) {
  return (
    await browserApiClient.get<AssessmentProgress>(
      `/care/assessments/by-id/${encodeURIComponent(assessmentId)}/progress`,
    )
  ).data
}

export async function startAnonymousAssessmentSession() {
  const response = await browserApiClient.post<{ expiresAt: string }>(
    '/care/anonymous-session',
  )
  return response.data
}

export async function clearAnonymousAssessmentSession() {
  await browserApiClient.delete('/care/anonymous-session')
}

export async function submitAssessment(
  mode: AssessmentMode,
  submission: AssessmentSubmissionRequest,
  idempotencyKey: string,
) {
  const endpoint =
    mode === 'anonymous'
      ? '/care/anonymous-assessments/current'
      : '/care/assessments/current'
  const response = await browserApiClient.post<AssessmentView>(
    endpoint,
    submission,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function reopenAssessment(
  mode: AssessmentMode,
  assessmentId?: string,
) {
  const endpoint =
    mode === 'authenticated' && assessmentId
      ? `/care/assessments/by-id/${encodeURIComponent(assessmentId)}`
      : mode === 'anonymous'
        ? '/care/anonymous-assessments/current'
        : '/care/assessments/current'
  const response = await browserApiClient.get<AssessmentView>(endpoint)
  return response.data
}

export function createAssessmentIdempotencyKey() {
  return crypto.randomUUID()
}

export function isMissingCurrentAssessment(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 404 || error.status === 410)
  )
}

export function assessmentErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'QUESTIONNAIRE_NOT_FOUND') {
      return 'Bản câu hỏi tiếng Việt đã được duyệt hiện chưa khả dụng. MentalBridge sẽ không tự tạo hoặc dịch nội dung thay thế.'
    }
    if (
      error.code === 'ANONYMOUS_SESSION_EXPIRED' ||
      error.code === 'INVALID_ANONYMOUS_SESSION'
    ) {
      return 'Phiên đánh giá ẩn danh đã hết hạn hoặc không còn hợp lệ. Vui lòng bắt đầu một phiên mới.'
    }
    if (error.code === 'FORBIDDEN') {
      return 'Tài khoản hiện tại không có quyền thực hiện bài đánh giá này.'
    }
    if (error.code === 'PROFILE_NOT_FOUND') {
      return 'Bạn cần tạo hồ sơ trước khi thực hiện bài sàng lọc có lưu lịch sử.'
    }
    if (error.code === 'PRIVACY_DISCLOSURE_REQUIRED') {
      return 'Bạn cần đọc và đồng ý với nội dung xử lý dữ liệu hiện hành trước khi gửi bài.'
    }
    if (error.status === 409) {
      return 'Lần gửi này xung đột với một yêu cầu trước đó. Vui lòng bắt đầu lại bài đánh giá.'
    }
    if (error.status === 429) {
      return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một lúc rồi thử lại.'
    }
    if (
      [
        'CARE_TIMEOUT',
        'CARE_UNAVAILABLE',
        'NETWORK_ERROR',
        'REQUEST_TIMEOUT',
      ].includes(error.code)
    ) {
      return 'Tính năng sàng lọc tạm thời chưa sẵn sàng. Câu trả lời của bạn chưa được xác nhận là đã lưu.'
    }
    if (error.code === 'VALIDATION_FAILED') {
      return 'Câu trả lời chưa đầy đủ hoặc không còn phù hợp với phiên bản câu hỏi hiện tại.'
    }
  }

  return 'Không thể hoàn tất bài đánh giá lúc này. Vui lòng thử lại.'
}
