import { z } from 'zod'

import { availabilityModalitySchema } from '@/specialist/specialist-contract'

// Consultation public OpenAPI v1.12.0. No private eligibility/ledger commands.
const id = z.uuid()
const instant = z.iso.datetime({ offset: true })
const version = z.number().int().nonnegative().safe()
const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('vi-VN', { timeZone: value }).format(0)
      return true
    } catch {
      return false
    }
  })
const uniqueIds = (items: { id: string }[]) =>
  new Set(items.map((item) => item.id)).size === items.length
export const appointmentStatus = z.enum([
  'REQUESTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'SESSION_ENDED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
])
const outcome = z.enum(['RELEASED', 'FORFEITED', 'TRANSFERRED_TO_REPLACEMENT'])
const creditState = z.enum(['AVAILABLE', 'HELD', 'CONSUMED', 'FORFEITED'])
const source = z.enum(['DEFAULT_FREE', 'DEMO', 'PAID'])
const packageCode = z.enum(['FREE', 'PLUS', 'PREMIUM'])
const policyVersion = z.enum([
  'consultation-credit-v1',
  'consultation-credit-v2',
])
export const appointmentSchema = z
  .strictObject({
    id,
    slotId: id,
    specialistAccountId: id,
    specialistDisplayName: z.string().min(1).max(120),
    status: appointmentStatus,
    modality: availabilityModalitySchema,
    scheduledStartAt: instant,
    scheduledEndAt: instant,
    timezone,
    requestedAt: instant,
    decisionDeadlineAt: instant,
    heldCreditId: id,
    replacesAppointmentId: id.nullable(),
    replacedByAppointmentId: id.nullable(),
    decidedAt: instant.nullable(),
    decisionReason: z
      .enum([
        'SPECIALIST_ACCEPTED',
        'SPECIALIST_REJECTED',
        'DECISION_DEADLINE_EXPIRED',
      ])
      .nullable(),
    cancelledAt: instant.nullable(),
    cancellationReason: z
      .enum(['USER_CANCELLED', 'USER_RESCHEDULED', 'SPECIALIST_SUSPENDED'])
      .nullable(),
    cancellationActor: z.enum(['USER', 'ADMIN']).nullable(),
    cancellationCreditOutcome: outcome.nullable(),
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
    sessionOutcomeReason: z.string().max(64).nullable(),
    sessionPolicyVersion: z.literal('chat-session-completion-v1').nullable(),
    sessionEndedAt: instant.nullable(),
    sessionSettledAt: instant.nullable(),
    completionFactId: id.nullable(),
    creditState,
    history: z
      .array(
        z.strictObject({
          eventId: id,
          fromStatus: appointmentStatus.nullable(),
          toStatus: appointmentStatus,
          actorType: z.enum(['USER', 'SPECIALIST', 'ADMIN', 'SYSTEM']),
          actorId: id.nullable(),
          reason: z.enum([
            'APPOINTMENT_REQUESTED',
            'USER_CANCELLED',
            'USER_RESCHEDULED',
            'SPECIALIST_ACCEPTED',
            'SPECIALIST_REJECTED',
            'DECISION_DEADLINE_EXPIRED',
            'SPECIALIST_SUSPENDED',
            'SESSION_ACTIVITY_OBSERVED',
            'SCHEDULED_WINDOW_ENDED',
            'EVIDENCE_REQUIREMENTS_MET',
          ]),
          creditOutcome: outcome.nullable(),
          occurredAt: instant,
        }),
      )
      .max(20),
    version,
  })
  .refine(
    (item) =>
      Date.parse(item.scheduledEndAt) - Date.parse(item.scheduledStartAt) ===
      3_600_000,
  )
export const appointmentListSchema = z
  .strictObject({
    items: z.array(appointmentSchema).max(100),
    count: z.number().int().min(0).max(100),
    generatedAt: instant,
  })
  .refine((list) => list.count === list.items.length && uniqueIds(list.items))
export const bookableSlotSchema = z
  .strictObject({
    id,
    specialistAccountId: id,
    specialistDisplayName: z.string().min(1).max(120),
    startAt: instant,
    endAt: instant,
    timezone,
    modality: availabilityModalitySchema,
  })
  .refine(
    (slot) => Date.parse(slot.endAt) - Date.parse(slot.startAt) === 3_600_000,
  )
export const bookableSlotsSchema = z
  .strictObject({
    items: z.array(bookableSlotSchema).max(200),
    count: z.number().int().min(0).max(200),
    generatedAt: instant,
    videoEnabled: z.boolean(),
  })
  .refine(
    (list) =>
      list.count === list.items.length &&
      uniqueIds(list.items) &&
      (list.videoEnabled ||
        list.items.every((slot) => slot.modality === 'IN_APP_CHAT')),
  )
export const creditAccountSchema = z.strictObject({
  accountId: id,
  packageCode,
  source,
  sourceReference: z.string().min(1).max(128).nullable(),
  periodStart: instant.nullable(),
  periodEnd: instant.nullable(),
  policyVersion,
  balance: z.strictObject({
    available: version,
    held: version,
    consumed: version,
    forfeited: version,
    total: z.number().int().min(0).max(10),
    releasedTransitions: version,
  }),
  reservationCapacity: z.strictObject({
    active: version,
    maximum: z.number().int().min(0).max(4),
    remaining: z.number().int().min(0).max(4),
  }),
  history: z
    .array(
      z.strictObject({
        eventId: id,
        creditId: id,
        eventType: z.enum([
          'PROVISIONED',
          'HELD',
          'CONSUMED',
          'RELEASED',
          'FORFEITED',
        ]),
        source,
        packageCode,
        policyVersion,
        appointmentId: id.nullable(),
        occurredAt: instant,
      }),
    )
    .max(100),
  generatedAt: instant,
})
export const requestAppointmentSchema = z.strictObject({
  slotId: id,
  modality: availabilityModalitySchema,
  replacesAppointmentId: id.optional(),
})
export const commandKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[!-~]+$/)
export const appointmentVersionSchema = version
export type Appointment = z.infer<typeof appointmentSchema>
export type AppointmentList = z.infer<typeof appointmentListSchema>
export type CreditAccount = z.infer<typeof creditAccountSchema>
export type RequestAppointment = z.infer<typeof requestAppointmentSchema>
