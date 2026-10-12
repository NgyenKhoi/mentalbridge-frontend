import { z } from 'zod'

const screeningContextSchema = z
  .object({
    instrument: z.enum(['PHQ9', 'GAD7']),
    domain: z.enum(['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS']),
    screeningLevel: z.enum([
      'MINIMAL',
      'MILD',
      'MODERATE',
      'MODERATELY_SEVERE',
      'SEVERE',
    ]),
    questionnaireVersion: z.string().min(1).max(32),
    scoringVersion: z.string().min(1).max(32),
    evaluatedAt: z.iso.datetime(),
    policyVersion: z.string().min(1).max(64),
  })
  .strict()

export const specialistConsultationBriefSchema = z
  .object({
    snapshotId: z.uuid(),
    appointmentId: z.uuid(),
    currentSituation: z.string().min(1).max(1000),
    supportEvaluationId: z.uuid(),
    screeningContext: z.array(screeningContextSchema).length(2),
    userGoals: z.array(z.string().min(1).max(200)).min(1).max(5),
    snapshotVersion: z.number().int().min(1),
    approvedAt: z.iso.datetime(),
    accessStartAt: z.iso.datetime(),
    accessEndAt: z.iso.datetime(),
    sourceType: z.literal('CONSULTATION_BRIEF'),
  })
  .strict()

export const briefAccessStateSchema = z.enum([
  'NOT_SHARED',
  'REVOKED',
  'STALE',
  'TOO_EARLY',
  'AVAILABLE',
  'EXPIRED',
  'UNAVAILABLE',
])

export const specialistClientContinuityItemSchema = z
  .object({
    appointmentId: z.uuid(),
    userAccountId: z.uuid(),
    userDisplayName: z.string().min(1).max(120),
    status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED', 'COMPLETED']),
    modality: z.enum(['IN_APP_CHAT', 'IN_APP_VIDEO']),
    scheduledStartAt: z.iso.datetime(),
    scheduledEndAt: z.iso.datetime(),
    appointmentVersion: z.number().int().nonnegative(),
    briefAccessState: briefAccessStateSchema,
    briefSnapshotVersion: z.number().int().min(1).nullable(),
    briefAccessStartAt: z.iso.datetime().nullable(),
    briefAccessEndAt: z.iso.datetime().nullable(),
  })
  .strict()

export const specialistClientContinuityListSchema = z
  .object({
    items: z.array(specialistClientContinuityItemSchema).max(200),
    count: z.number().int().min(0).max(200),
    generatedAt: z.iso.datetime(),
    recentSince: z.iso.datetime(),
    policyVersion: z.literal('specialist-client-continuity-v1'),
  })
  .strict()
  .refine((value) => value.count === value.items.length, {
    path: ['count'],
    message: 'count must match items',
  })

export type SpecialistConsultationBrief = z.infer<
  typeof specialistConsultationBriefSchema
>
export type SpecialistClientContinuityItem = z.infer<
  typeof specialistClientContinuityItemSchema
>
export type SpecialistClientContinuityList = z.infer<
  typeof specialistClientContinuityListSchema
>
