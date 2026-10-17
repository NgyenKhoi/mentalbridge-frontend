import { z } from 'zod'

// Consultation AppointmentChatEligibility + Realtime REST/WebSocket v1.
const id = z.uuid()
const instant = z.iso.datetime({ offset: true })
const correlation = z.string().min(1).max(128)
export const eligibilitySchema = z
  .strictObject({
    conversationId: id,
    appointmentId: id,
    userAccountId: id,
    specialistAccountId: id,
    phase: z.enum([
      'NOT_AVAILABLE',
      'TOO_EARLY',
      'WAITING',
      'ACTIVE',
      'ENDED_PROCESSING',
      'COMPLETED',
      'USER_NO_SHOW',
      'SPECIALIST_NO_SHOW',
      'BOTH_NO_SHOW',
      'INSUFFICIENT_EVIDENCE',
      'EVIDENCE_REVIEW',
      'CANCELLED',
      'RESCHEDULED',
    ]),
    reasonCode: z.enum([
      'APPOINTMENT_NOT_CONFIRMED',
      'CHAT_ENTRY_TOO_EARLY',
      'APPOINTMENT_WAITING',
      'APPOINTMENT_ACTIVE',
      'SESSION_OUTCOME_PROCESSING',
      'SESSION_EVIDENCE_REVIEW',
      'SESSION_COMPLETED',
      'SESSION_USER_NO_SHOW',
      'SESSION_SPECIALIST_NO_SHOW',
      'SESSION_BOTH_NO_SHOW',
      'SESSION_INSUFFICIENT_EVIDENCE',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_RESCHEDULED',
    ]),
    subscribeAllowed: z.boolean(),
    sendAllowed: z.boolean(),
    historyAllowed: z.boolean(),
    checkInAllowed: z.boolean(),
    participantCheckedIn: z.boolean(),
    sessionOutcome: z
      .enum([
        'COMPLETED',
        'USER_NO_SHOW',
        'SPECIALIST_NO_SHOW',
        'BOTH_NO_SHOW',
        'INSUFFICIENT_EVIDENCE',
        'EVIDENCE_REVIEW',
      ])
      .nullable(),
    creditState: z.enum(['AVAILABLE', 'HELD', 'CONSUMED', 'FORFEITED']),
    scheduledStartAt: instant,
    scheduledEndAt: instant,
    serverTime: instant,
  })
  .refine(
    (value) =>
      Date.parse(value.scheduledStartAt) < Date.parse(value.scheduledEndAt),
  )
export const messageSchema = z.strictObject({
  messageId: id,
  conversationId: id,
  senderId: id,
  clientMessageId: id,
  type: z.literal('TEXT'),
  content: z.string().min(1).max(4000),
  sentAt: instant,
  schemaVersion: z.literal(1),
})
export const historySchema = z
  .strictObject({
    items: z.array(messageSchema).max(100),
    nextCursor: z.string().min(1).max(512).nullable(),
    hasMore: z.boolean(),
  })
  .refine((page) => page.hasMore === (page.nextCursor !== null))
export const credentialSchema = z.strictObject({
  accessToken: z.string().min(32).max(128),
  expiresAt: instant,
})
export const acknowledgementSchema = z.strictObject({
  schemaVersion: z.literal(1),
  commandId: id,
  correlationId: correlation,
  status: z.enum(['accepted', 'duplicate']),
  acknowledgedAt: instant,
  messageId: id.optional(),
  liveDelivery: z.enum(['delivered', 'degraded', 'not_applicable']).optional(),
})
export const errorSchema = z.strictObject({
  schemaVersion: z.literal(1),
  commandId: id.optional(),
  correlationId: correlation,
  code: z.enum([
    'AUTHENTICATION_REQUIRED',
    'AUTHENTICATION_EXPIRED',
    'INVALID_ENVELOPE',
    'UNSUPPORTED_SCHEMA_VERSION',
    'PAYLOAD_TOO_LARGE',
    'RATE_LIMITED',
    'ACCESS_DENIED',
    'CHAT_ELIGIBILITY_UNAVAILABLE',
    'CHAT_EVIDENCE_UNAVAILABLE',
    'EVIDENCE_WINDOW_CLOSED',
    'EVIDENCE_OCCURRED_OUTSIDE_WINDOW',
    'EVIDENCE_ID_CONFLICT',
    'INVALID_EVIDENCE_SHAPE',
    'INVALID_PRESENCE_INTERVAL',
    'APPOINTMENT_NOT_ELIGIBLE',
    'APPOINTMENT_NOT_CONFIRMED',
    'CHAT_NOT_STARTED',
    'CHAT_ENDED',
    'CHAT_CANCELLED',
    'CHAT_RESCHEDULED',
    'CONVERSATION_BINDING_CONFLICT',
    'IDEMPOTENCY_CONFLICT',
    'DEPENDENCY_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]),
  message: z.string().min(1).max(200),
  retryable: z.boolean(),
})
const eventBase = {
  schemaVersion: z.literal(1),
  eventId: id,
  correlationId: correlation,
  occurredAt: instant,
}
export const eventSchema = z.discriminatedUnion('eventType', [
  z.strictObject({
    ...eventBase,
    eventType: z.literal('connection.ready'),
    payload: z.strictObject({
      accountId: id,
      role: z.enum(['USER', 'SPECIALIST', 'ADMIN']),
      presence: z.enum(['connected', 'degraded']),
    }),
  }),
  z.strictObject({
    ...eventBase,
    eventType: z.literal('message.created'),
    payload: messageSchema,
  }),
])
export type Eligibility = z.infer<typeof eligibilitySchema>
export type ChatMessage = z.infer<typeof messageSchema>
export type ChatOperation = 'SUBSCRIBE' | 'SEND' | 'HISTORY' | 'CHECK_IN'
export type ChatRole = 'USER' | 'SPECIALIST'
export type ChatCommand = Readonly<{
  schemaVersion: 1
  commandId: string
  correlationId: string
  sentAt: string
  commandType:
    | 'conversation.subscribe'
    | 'conversation.check-in'
    | 'message.send'
    | 'presence.heartbeat'
  payload: Readonly<{
    conversationId?: string
    clientMessageId?: string
    type?: 'TEXT'
    content?: string
  }>
}>
