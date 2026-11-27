import { z } from 'zod'

const id = z.uuid()
const instant = z.iso.datetime({ offset: true })
const version = z.number().int().nonnegative().safe()
export const videoCompletionSchema = z
  .strictObject({
    appointmentId: id,
    confirmationId: id,
    verificationState: z.enum([
      'PENDING_VERIFICATION',
      'VERIFIED',
      'EVIDENCE_REVIEW',
    ]),
    appointmentStatus: z.enum(['SESSION_ENDED', 'COMPLETED']),
    creditState: z.enum(['AVAILABLE', 'HELD', 'CONSUMED', 'FORFEITED']),
    completionFactId: id.nullable(),
    acceptedAt: instant,
    manualReviewAt: instant,
    version,
  })
  .refine(
    (item) =>
      Date.parse(item.manualReviewAt) - Date.parse(item.acceptedAt) ===
        86_400_000 &&
      (item.verificationState === 'VERIFIED'
        ? item.appointmentStatus === 'COMPLETED' &&
          item.completionFactId !== null &&
          ['CONSUMED', 'AVAILABLE'].includes(item.creditState)
        : item.appointmentStatus === 'SESSION_ENDED' &&
          item.creditState === 'HELD' &&
          item.completionFactId === null),
  )
export const videoSessionSchema = z
  .strictObject({
    appointmentId: id,
    phase: z.enum([
      'TOO_EARLY',
      'WAITING',
      'ACTIVE',
      'ENDED',
      'COMPLETED',
      'NOT_AVAILABLE',
      'UNAVAILABLE',
    ]),
    previewAllowed: z.boolean(),
    joinAllowed: z.boolean(),
    startsAt: instant,
    endsAt: instant,
    serverTime: instant,
    version,
    completion: videoCompletionSchema.nullable(),
  })
  .refine(
    (item) =>
      Date.parse(item.endsAt) - Date.parse(item.startsAt) === 3_600_000 &&
      item.joinAllowed === (item.phase === 'ACTIVE') &&
      item.previewAllowed === ['WAITING', 'ACTIVE'].includes(item.phase) &&
      (item.completion === null ||
        (item.completion.appointmentId === item.appointmentId &&
          item.completion.version === item.version &&
          (item.completion.verificationState === 'VERIFIED'
            ? item.phase === 'COMPLETED'
            : item.phase === 'ENDED'))),
  )
export const videoAccessSchema = z
  .strictObject({
    appointmentId: id,
    provider: z.literal('LIVEKIT'),
    serverUrl: z.string().refine((value) => {
      try {
        const url = new URL(value)
        return (
          url.protocol === 'wss:' &&
          /^[a-z0-9-]+\.livekit\.cloud$/.test(url.hostname) &&
          !url.port &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/'
        )
      } catch {
        return false
      }
    }),
    roomName: z.string().regex(/^mb-[0-9a-f-]{36}$/),
    participantToken: z
      .string()
      .max(16_384)
      .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
    expiresAt: instant,
    endsAt: instant,
  })
  .refine((item) => Date.parse(item.expiresAt) <= Date.parse(item.endsAt))
export type VideoSession = z.infer<typeof videoSessionSchema>
export type VideoAccess = z.infer<typeof videoAccessSchema>
export type VideoCompletion = z.infer<typeof videoCompletionSchema>
