import { z } from 'zod'

export const appointmentStatusSchema = z.enum([
  'REQUESTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'SESSION_ENDED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
])

export const appointmentModalitySchema = z.enum(['IN_APP_CHAT', 'IN_APP_VIDEO'])

const cancellationCreditOutcomeSchema = z.enum([
  'RELEASED',
  'FORFEITED',
  'TRANSFERRED_TO_REPLACEMENT',
])

export const appointmentHistoryEntrySchema = z
  .object({
    eventId: z.uuid(),
    fromStatus: appointmentStatusSchema.nullable(),
    toStatus: appointmentStatusSchema,
    actorType: z.enum(['USER', 'SPECIALIST', 'ADMIN', 'SYSTEM']),
    actorId: z.uuid().nullable(),
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
    creditOutcome: cancellationCreditOutcomeSchema.nullable(),
    occurredAt: z.iso.datetime(),
  })
  .strict()

export const specialistAppointmentSchema = z
  .object({
    id: z.uuid(),
    slotId: z.uuid(),
    specialistAccountId: z.uuid(),
    specialistDisplayName: z.string().min(1).max(120),
    status: appointmentStatusSchema,
    modality: appointmentModalitySchema,
    scheduledStartAt: z.iso.datetime(),
    scheduledEndAt: z.iso.datetime(),
    timezone: z.string().min(1).max(64),
    requestedAt: z.iso.datetime(),
    decisionDeadlineAt: z.iso.datetime(),
    heldCreditId: z.uuid(),
    replacesAppointmentId: z.uuid().nullable(),
    replacedByAppointmentId: z.uuid().nullable(),
    decidedAt: z.iso.datetime().nullable(),
    decisionReason: z
      .enum([
        'SPECIALIST_ACCEPTED',
        'SPECIALIST_REJECTED',
        'DECISION_DEADLINE_EXPIRED',
      ])
      .nullable(),
    cancelledAt: z.iso.datetime().nullable(),
    cancellationReason: z
      .enum(['USER_CANCELLED', 'USER_RESCHEDULED', 'SPECIALIST_SUSPENDED'])
      .nullable(),
    cancellationActor: z.enum(['USER', 'ADMIN']).nullable(),
    cancellationCreditOutcome: cancellationCreditOutcomeSchema.nullable(),
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
    sessionEndedAt: z.iso.datetime().nullable(),
    sessionSettledAt: z.iso.datetime().nullable(),
    completionFactId: z.uuid().nullable(),
    creditState: z.enum(['AVAILABLE', 'HELD', 'CONSUMED', 'FORFEITED']),
    history: z.array(appointmentHistoryEntrySchema).max(20),
    version: z.number().int().nonnegative(),
  })
  .strict()

export const specialistAppointmentListSchema = z
  .object({
    items: z.array(specialistAppointmentSchema).max(100),
    count: z.number().int().min(0).max(100),
    generatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((value) => value.count === value.items.length, {
    path: ['count'],
    message: 'count must match items',
  })

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>
export type SpecialistAppointment = z.infer<typeof specialistAppointmentSchema>
export type SpecialistAppointmentList = z.infer<
  typeof specialistAppointmentListSchema
>
