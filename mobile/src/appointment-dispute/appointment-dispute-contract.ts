import { z } from 'zod'

import { appointmentStatus } from '@/appointments/appointment-contract'

const id = z.uuid()
const instant = z.iso.datetime({ offset: true })
const version = z.number().int().nonnegative().safe()

export const appointmentDisputeReasonSchema = z.enum([
  'OUTCOME_INCORRECT',
  'PARTICIPATION_EVIDENCE_INCORRECT',
  'SESSION_DELIVERY_NOT_RECOGNIZED',
  'TECHNICAL_FAILURE',
])
const appointmentDisputeEvidenceTypeSchema = z.enum([
  'ACCESS_LOG',
  'CONNECTION_INCIDENT',
  'PROVIDER_INCIDENT',
])
const appointmentDisputeResolutionOutcomeSchema = z.enum([
  'UPHOLD_RECORDED_OUTCOME',
  'RELEASE_USER_CREDIT',
])
const appointmentDisputeResolutionReasonSchema = z.enum([
  'EVIDENCE_SUPPORTS_RECORDED_OUTCOME',
  'EVIDENCE_INCONCLUSIVE_RELEASED',
  'TECHNICAL_FAILURE_CONFIRMED',
])
const appointmentSessionOutcomeSchema = z.enum([
  'COMPLETED',
  'USER_NO_SHOW',
  'SPECIALIST_NO_SHOW',
  'BOTH_NO_SHOW',
  'INSUFFICIENT_EVIDENCE',
  'EVIDENCE_REVIEW',
])

// The mobile USER flow deliberately sends no evidence payload. Operational
// evidence remains server-owned and cannot be replaced with private free text.
export const openAppointmentDisputeSchema = z.strictObject({
  reasonCode: appointmentDisputeReasonSchema,
  evidenceType: z.null(),
  evidenceOccurredAt: z.null(),
})

export const appointmentDisputeSchema = z
  .strictObject({
    id,
    appointmentId: id,
    appointmentVersion: version,
    status: z.enum(['OPEN', 'RESOLVED']),
    openedByRole: z.enum(['USER', 'SPECIALIST']),
    reasonCode: appointmentDisputeReasonSchema,
    evidenceType: appointmentDisputeEvidenceTypeSchema.nullable(),
    evidenceOccurredAt: instant.nullable(),
    openedAt: instant,
    eligibleUntil: instant,
    settlementGated: z.boolean(),
    resolutionOutcome: appointmentDisputeResolutionOutcomeSchema.nullable(),
    resolutionReason: appointmentDisputeResolutionReasonSchema.nullable(),
    resolvedAt: instant.nullable(),
    priorAppointmentStatus: appointmentStatus.nullable(),
    priorSessionOutcome: appointmentSessionOutcomeSchema.nullable(),
    resultingAppointmentStatus: appointmentStatus.nullable(),
    resultingSessionOutcome: appointmentSessionOutcomeSchema.nullable(),
    creditAction: z
      .enum(['NONE', 'ALREADY_AVAILABLE', 'ADJUSTED_RELEASED'])
      .nullable(),
    version,
  })
  .refine(
    (value) =>
      (value.evidenceType === null) === (value.evidenceOccurredAt === null),
    { path: ['evidenceType'] },
  )
  .refine(
    (value) => {
      const resolved = value.status === 'RESOLVED'
      return (
        resolved === (value.resolutionOutcome !== null) &&
        resolved === (value.resolutionReason !== null) &&
        resolved === (value.resolvedAt !== null) &&
        resolved === (value.creditAction !== null)
      )
    },
    { path: ['status'] },
  )

export type AppointmentDispute = z.infer<typeof appointmentDisputeSchema>
export type AppointmentDisputeReason = z.infer<
  typeof appointmentDisputeReasonSchema
>
export type OpenAppointmentDispute = z.infer<
  typeof openAppointmentDisputeSchema
>
