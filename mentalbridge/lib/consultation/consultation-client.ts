import 'server-only'

import { readConsultationServerConfig } from '@/lib/config/server'
import {
  parseAvailabilitySlot,
  parseAvailabilitySlotList,
  parseAppointment,
  parseAppointmentRating,
  parseAppointmentList,
  parseAppointmentChatEligibility,
  parseBookableSlotList,
  parsePendingProfiles,
  parseProblem,
  parseProfile,
  parseServiceCreditAccount,
  parseSpecialistDashboard,
  parseSpecialistDiscoveryItem,
  parseSpecialistDiscoveryPage,
  parseSpecialistSuspensionResult,
  parseAdminAppointmentPage,
  type PendingProfiles,
  type AvailabilitySlot,
  type AvailabilitySlotList,
  type PublishAvailabilityInput,
  type SpecialistProfile,
  type SpecialistProfileInput,
  type ServiceCreditAccount,
  type SpecialistDiscoveryItem,
  type SpecialistDiscoveryPage,
  type SpecialistApprovalStatus,
  type SpecialistDecisionReason,
  type SpecialistSuspensionResult,
  type SpecialistDashboard,
  type Appointment,
  type AppointmentRating,
  type AppointmentList,
  type AppointmentChatEligibility,
  type AppointmentRequestInput,
  type BookableSlotList,
  parseConsultationOperationsSummary,
  type ConsultationOperationsSummary,
  type AdminAppointmentPage,
} from './consultation-validation'
import {
  parseSessionSummary,
  parseSessionSummaryList,
  type PublishSessionSummaryInput,
  type SessionSummary,
  type SessionSummaryList,
  type SessionSummaryReuseConsentInput,
  type UpdateAgreedNextStepInput,
} from './session-summary-validation'

const MAX_RESPONSE_BYTES = 128 * 1024

export class ConsultationServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId?: string,
    cause?: unknown,
  ) {
    super(message, { cause })
  }
}

type Result<T> = Readonly<{ data: T; etag: string | null }>

async function json(response: Response) {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw malformed()
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
    throw malformed()
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw malformed(cause)
  }
}

function malformed(cause?: unknown) {
  return new ConsultationServiceError(
    502,
    'CONSULTATION_MALFORMED_RESPONSE',
    'Consultation returned an invalid response.',
    undefined,
    cause,
  )
}

async function request<T>(options: {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE'
  path: string
  token: string
  correlationId: string
  body?: unknown
  ifMatch?: string
  idempotencyKey?: string
  parse: (value: unknown) => T | null
}): Promise<Result<T>> {
  const config = readConsultationServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(options.path.replace(/^\//, ''), config.baseUrl),
      {
        method: options.method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          Authorization: `Bearer ${options.token}`,
          'X-Correlation-Id': options.correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {}),
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )
    const value = await json(response)
    if (!response.ok) {
      const problem = parseProblem(value, response.status)
      if (!problem) throw malformed()
      throw new ConsultationServiceError(
        problem.status,
        problem.code,
        problem.title,
        problem.correlationId,
      )
    }
    const parsed = options.parse(value)
    if (!parsed) throw malformed()
    return { data: parsed, etag: response.headers.get('etag') }
  } catch (error) {
    if (error instanceof ConsultationServiceError) throw error
    if (controller.signal.aborted)
      throw new ConsultationServiceError(
        504,
        'CONSULTATION_TIMEOUT',
        'Consultation request timed out.',
        undefined,
        error,
      )
    throw new ConsultationServiceError(
      503,
      'CONSULTATION_UNAVAILABLE',
      'Consultation is unavailable.',
      undefined,
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

const profileRequest = (
  method: 'GET' | 'PUT' | 'POST',
  path: string,
  token: string,
  correlationId: string,
  body?: unknown,
  ifMatch?: string,
) =>
  request<SpecialistProfile>({
    method,
    path,
    token,
    correlationId,
    body,
    ifMatch,
    parse: parseProfile,
  })

export const consultationClient = {
  adminAppointments(token: string, correlationId: string, query: string) {
    return request<AdminAppointmentPage>({
      method: 'GET',
      path: `/api/v1/admin/appointments?${query}`,
      token,
      correlationId,
      parse: parseAdminAppointmentPage,
    })
  },
  appointmentRating(
    token: string,
    correlationId: string,
    appointmentId: string,
  ) {
    return request<AppointmentRating>({
      method: 'GET',
      path: `/api/v1/appointments/${encodeURIComponent(appointmentId)}/rating`,
      token,
      correlationId,
      parse: parseAppointmentRating,
    })
  },
  saveAppointmentRating(
    token: string,
    correlationId: string,
    appointmentId: string,
    rating: number,
    etag?: string,
  ) {
    return request<AppointmentRating>({
      method: 'PUT',
      path: `/api/v1/appointments/${encodeURIComponent(appointmentId)}/rating`,
      token,
      correlationId,
      body: { rating },
      ifMatch: etag,
      parse: parseAppointmentRating,
    })
  },
  specialistDashboard(token: string, correlationId: string) {
    return request<SpecialistDashboard>({
      method: 'GET',
      path: '/api/v1/specialist/dashboard',
      token,
      correlationId,
      parse: parseSpecialistDashboard,
    })
  },
  userSessionSummaries(
    token: string,
    correlationId: string,
    appointmentId: string,
  ) {
    return request<SessionSummaryList>({
      method: 'GET',
      path: `/api/v1/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
      token,
      correlationId,
      parse: parseSessionSummaryList,
    })
  },
  specialistSessionSummaries(
    token: string,
    correlationId: string,
    appointmentId: string,
  ) {
    return request<SessionSummaryList>({
      method: 'GET',
      path: `/api/v1/specialist/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
      token,
      correlationId,
      parse: parseSessionSummaryList,
    })
  },
  publishSessionSummary(
    token: string,
    correlationId: string,
    appointmentId: string,
    body: PublishSessionSummaryInput,
    idempotencyKey: string,
    ifMatch?: string,
  ) {
    return request<SessionSummary>({
      method: 'POST',
      path: `/api/v1/specialist/appointments/${encodeURIComponent(appointmentId)}/session-summaries`,
      token,
      correlationId,
      body,
      idempotencyKey,
      ifMatch,
      parse: parseSessionSummary,
    })
  },
  updateSessionSummaryReuseConsent(
    token: string,
    correlationId: string,
    summaryId: string,
    body: SessionSummaryReuseConsentInput,
    ifMatch: string,
  ) {
    return request<SessionSummary>({
      method: 'PUT',
      path: `/api/v1/session-summaries/${encodeURIComponent(summaryId)}/reuse-consent`,
      token,
      correlationId,
      body,
      ifMatch,
      parse: parseSessionSummary,
    })
  },
  updateAgreedNextStep(
    token: string,
    correlationId: string,
    nextStepId: string,
    body: UpdateAgreedNextStepInput,
    ifMatch: string,
  ) {
    return request<SessionSummary>({
      method: 'PUT',
      path: `/api/v1/agreed-next-steps/${encodeURIComponent(nextStepId)}`,
      token,
      correlationId,
      body,
      ifMatch,
      parse: parseSessionSummary,
    })
  },
  chatEligibility(
    token: string,
    correlationId: string,
    conversationId: string,
    operation: 'SUBSCRIBE' | 'SEND' | 'HISTORY' | 'CHECK_IN',
  ) {
    return request<AppointmentChatEligibility>({
      method: 'GET',
      path: `/internal/v1/appointments/${encodeURIComponent(conversationId)}/chat-eligibility?operation=${operation}`,
      token,
      correlationId,
      parse: parseAppointmentChatEligibility,
    })
  },
  discoverSpecialists(token: string, correlationId: string, query = '') {
    return request<SpecialistDiscoveryPage>({
      method: 'GET',
      path: `/api/v1/specialists${query}`,
      token,
      correlationId,
      parse: parseSpecialistDiscoveryPage,
    })
  },
  discoveredSpecialist(
    token: string,
    correlationId: string,
    specialistAccountId: string,
    query = '',
  ) {
    return request<SpecialistDiscoveryItem>({
      method: 'GET',
      path: `/api/v1/specialists/${encodeURIComponent(specialistAccountId)}${query}`,
      token,
      correlationId,
      parse: parseSpecialistDiscoveryItem,
    })
  },
  bookableSlots(token: string, correlationId: string, query = '') {
    return request<BookableSlotList>({
      method: 'GET',
      path: `/api/v1/bookable-slots${query}`,
      token,
      correlationId,
      parse: parseBookableSlotList,
    })
  },
  appointments(token: string, correlationId: string) {
    return request<AppointmentList>({
      method: 'GET',
      path: '/api/v1/appointments',
      token,
      correlationId,
      parse: parseAppointmentList,
    })
  },
  requestAppointment(
    token: string,
    correlationId: string,
    body: AppointmentRequestInput,
    idempotencyKey: string,
    replacementEtag?: string,
  ) {
    return request<Appointment>({
      method: 'POST',
      path: '/api/v1/appointments',
      token,
      correlationId,
      body,
      ifMatch: replacementEtag,
      idempotencyKey,
      parse: parseAppointment,
    })
  },
  cancelAppointment(
    token: string,
    correlationId: string,
    appointmentId: string,
    etag: string,
    idempotencyKey: string,
  ) {
    return request<Appointment>({
      method: 'POST',
      path: `/api/v1/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      token,
      correlationId,
      ifMatch: etag,
      idempotencyKey,
      parse: parseAppointment,
    })
  },
  assignedAppointments(token: string, correlationId: string) {
    return request<AppointmentList>({
      method: 'GET',
      path: '/api/v1/specialist/appointments',
      token,
      correlationId,
      parse: parseAppointmentList,
    })
  },
  decideAppointment(
    token: string,
    correlationId: string,
    appointmentId: string,
    decision: 'accept' | 'reject',
    etag: string,
    idempotencyKey: string,
  ) {
    return request<Appointment>({
      method: 'POST',
      path: `/api/v1/specialist/appointments/${encodeURIComponent(appointmentId)}/${decision}`,
      token,
      correlationId,
      ifMatch: etag,
      idempotencyKey,
      parse: parseAppointment,
    })
  },
  credits(token: string, correlationId: string) {
    return request<ServiceCreditAccount>({
      method: 'GET',
      path: '/api/v1/service-credits',
      token,
      correlationId,
      parse: parseServiceCreditAccount,
    })
  },
  own(token: string, correlationId: string) {
    return profileRequest(
      'GET',
      '/api/v1/specialist-profile',
      token,
      correlationId,
    )
  },
  save(
    token: string,
    correlationId: string,
    body: SpecialistProfileInput,
    etag?: string,
  ) {
    return profileRequest(
      'PUT',
      '/api/v1/specialist-profile',
      token,
      correlationId,
      body,
      etag,
    )
  },
  submit(token: string, correlationId: string, etag: string) {
    return profileRequest(
      'POST',
      '/api/v1/specialist-profile/submit',
      token,
      correlationId,
      undefined,
      etag,
    )
  },
  resubmit(token: string, correlationId: string, etag: string) {
    return profileRequest(
      'POST',
      '/api/v1/specialist-profile/resubmit',
      token,
      correlationId,
      undefined,
      etag,
    )
  },
  profiles(
    token: string,
    correlationId: string,
    status: SpecialistApprovalStatus,
  ) {
    return request<PendingProfiles>({
      method: 'GET',
      path: `/api/v1/admin/specialist-profiles?status=${status}&limit=100`,
      token,
      correlationId,
      parse: parsePendingProfiles,
    })
  },
  detail(token: string, correlationId: string, id: string) {
    return profileRequest(
      'GET',
      `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}`,
      token,
      correlationId,
    )
  },
  approve(token: string, correlationId: string, id: string, etag: string) {
    return profileRequest(
      'POST',
      `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}/approve`,
      token,
      correlationId,
      undefined,
      etag,
    )
  },
  reject(
    token: string,
    correlationId: string,
    id: string,
    etag: string,
    reasonCode: SpecialistDecisionReason,
  ) {
    return profileRequest(
      'POST',
      `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}/reject`,
      token,
      correlationId,
      { reasonCode },
      etag,
    )
  },
  suspend(
    token: string,
    correlationId: string,
    id: string,
    etag: string,
    reasonCode: SpecialistDecisionReason,
  ) {
    return request<SpecialistSuspensionResult>({
      method: 'POST',
      path: `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}/suspend`,
      token,
      correlationId,
      body: { reasonCode },
      ifMatch: etag,
      parse: parseSpecialistSuspensionResult,
    })
  },
  restore(token: string, correlationId: string, id: string, etag: string) {
    return profileRequest(
      'POST',
      `/api/v1/admin/specialist-profiles/${encodeURIComponent(id)}/restore`,
      token,
      correlationId,
      undefined,
      etag,
    )
  },
  availability(token: string, correlationId: string, query = '') {
    return request<AvailabilitySlotList>({
      method: 'GET',
      path: `/api/v1/availability-slots${query}`,
      token,
      correlationId,
      parse: parseAvailabilitySlotList,
    })
  },
  publishAvailability(
    token: string,
    correlationId: string,
    body: PublishAvailabilityInput,
    idempotencyKey: string,
  ) {
    return request<AvailabilitySlot>({
      method: 'POST',
      path: '/api/v1/availability-slots',
      token,
      correlationId,
      body,
      idempotencyKey,
      parse: parseAvailabilitySlot,
    })
  },
  withdrawAvailability(
    token: string,
    correlationId: string,
    id: string,
    etag: string,
  ) {
    return request<AvailabilitySlot>({
      method: 'DELETE',
      path: `/api/v1/availability-slots/${encodeURIComponent(id)}`,
      token,
      correlationId,
      ifMatch: etag,
      parse: parseAvailabilitySlot,
    })
  },
  async getOperationsSummary(
    token: string,
    correlationId: string,
  ): Promise<ConsultationOperationsSummary> {
    const result = await request<ConsultationOperationsSummary>({
      method: 'GET',
      path: '/api/v1/admin/operations/summary',
      token,
      correlationId,
      parse: parseConsultationOperationsSummary,
    })
    return result.data
  },
}
