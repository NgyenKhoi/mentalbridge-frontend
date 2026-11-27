import { z } from 'zod'

const instant = z.iso.datetime({ offset: true })

export const consultationBriefScreeningContextSchema = z.strictObject({
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
  evaluatedAt: instant,
  policyVersion: z.string().min(1).max(64),
})

const screeningContextPairSchema = z
  .array(consultationBriefScreeningContextSchema)
  .length(2)
  .refine(
    (contexts) =>
      contexts.some(
        (context) =>
          context.instrument === 'PHQ9' &&
          context.domain === 'DEPRESSIVE_SYMPTOMS',
      ) &&
      contexts.some(
        (context) =>
          context.instrument === 'GAD7' &&
          context.domain === 'ANXIETY_SYMPTOMS',
      ),
    { message: 'screening context must contain PHQ-9 and GAD-7' },
  )

export const consultationBriefDraftRequestSchema = z.strictObject({
  currentSituation: z.string().trim().min(1).max(1000),
  supportEvaluationId: z.uuid(),
  userGoals: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
})

export const consultationBriefSchema = z
  .strictObject({
    id: z.uuid(),
    appointmentId: z.uuid(),
    status: z.enum(['DRAFT', 'APPROVED']),
    currentSituation: z.string().min(1).max(1000),
    supportEvaluationId: z.uuid(),
    screeningContext: screeningContextPairSchema,
    userGoals: z.array(z.string().min(1).max(200)).min(1).max(5),
    approvedSnapshotId: z.uuid().nullable(),
    sharingStatus: z.enum(['NONE', 'ACTIVE', 'REVOKED']),
    accessStartAt: instant.nullable(),
    accessEndAt: instant.nullable(),
    version: z.number().int().nonnegative(),
    updatedAt: instant,
  })
  .superRefine((value, context) => {
    const validDraft =
      value.status !== 'DRAFT' ||
      (value.sharingStatus === 'NONE' &&
        value.approvedSnapshotId === null &&
        value.accessStartAt === null &&
        value.accessEndAt === null)
    const validApproval =
      value.status !== 'APPROVED' ||
      (value.sharingStatus !== 'NONE' && value.approvedSnapshotId !== null)
    const validActiveWindow =
      value.sharingStatus !== 'ACTIVE' ||
      (value.accessStartAt !== null && value.accessEndAt !== null)
    if (!validDraft || !validApproval || !validActiveWindow)
      context.addIssue({
        code: 'custom',
        message: 'brief lifecycle fields are inconsistent',
        path: ['status'],
      })
  })

export const consultationBriefScreeningContextChoiceSchema = z.strictObject({
  supportEvaluationId: z.uuid(),
  evaluatedAt: instant,
  screeningContext: screeningContextPairSchema,
})

export const consultationBriefScreeningContextListSchema = z
  .strictObject({
    items: z.array(consultationBriefScreeningContextChoiceSchema).max(20),
    count: z.number().int().min(0).max(20),
  })
  .refine((value) => value.count === value.items.length, {
    message: 'count must match items',
    path: ['count'],
  })

export type ConsultationBrief = z.infer<typeof consultationBriefSchema>
export type ConsultationBriefDraftRequest = z.infer<
  typeof consultationBriefDraftRequestSchema
>
export type ConsultationBriefScreeningContext = z.infer<
  typeof consultationBriefScreeningContextSchema
>
export type ConsultationBriefScreeningContextChoice = z.infer<
  typeof consultationBriefScreeningContextChoiceSchema
>
export type ConsultationBriefScreeningContextList = z.infer<
  typeof consultationBriefScreeningContextListSchema
>
