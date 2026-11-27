import { z } from 'zod'

export const supportAreaSchema = z.enum([
  'DEPRESSIVE_SYMPTOMS',
  'ANXIETY_SYMPTOMS',
])

export const specialistLanguageSchema = z.enum(['vi', 'en'])

export const specialistApprovalStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
])

export const specialistDecisionReasonSchema = z.enum([
  'PROFILE_INFORMATION_INCOMPLETE',
  'PROFILE_CONTENT_NOT_APPROVED',
  'OUTSIDE_SUPPORTED_SCOPE',
  'POLICY_VIOLATION',
  'QUALITY_REVIEW_REQUIRED',
  'ACCOUNT_REVIEW_REQUIRED',
])

export const specialistProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    bio: z.string().trim().min(1).max(2000),
    supportAreas: z.array(supportAreaSchema).min(1).max(2),
    languages: z.array(specialistLanguageSchema).min(1).max(2),
    yearsOfExperience: z.number().int().min(0).max(80),
    timezone: z.string().trim().min(1).max(64),
  })
  .strict()

export const specialistProfileSchema = z
  .object({
    accountId: z.uuid(),
    displayName: z.string().min(1).max(120),
    publishedVersion: z.number().int().nonnegative().optional(),
    bio: z.string().min(1).max(2000),
    supportAreas: z.array(supportAreaSchema).min(1).max(2),
    languages: z.array(specialistLanguageSchema).min(1).max(2),
    yearsOfExperience: z.number().int().min(0).max(80),
    timezone: z.string().min(1).max(64),
    approvalStatus: specialistApprovalStatusSchema,
    submittedAt: z.iso.datetime().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    reviewedBy: z.uuid().nullable(),
    decisionReasonCode: specialistDecisionReasonSchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    version: z.number().int().nonnegative(),
  })
  .strict()

export const availabilityModalitySchema = z.enum([
  'IN_APP_CHAT',
  'IN_APP_VIDEO',
])

export const publishAvailabilityRequestSchema = z
  .object({
    startAt: z.iso.datetime({ offset: false }),
    endAt: z.iso.datetime({ offset: false }),
    timezone: z.string().min(1).max(64),
    modality: availabilityModalitySchema,
  })
  .strict()

export const availabilitySlotSchema = z
  .object({
    id: z.uuid(),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
    timezone: z.string().min(1).max(64),
    modality: availabilityModalitySchema,
    status: z.enum(['ACTIVE', 'WITHDRAWN']),
    readiness: z.enum(['AVAILABLE', 'STARTED', 'WITHDRAWN', 'VIDEO_DISABLED']),
    withdrawnAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    version: z.number().int().nonnegative(),
  })
  .strict()

export const availabilitySlotListSchema = z
  .object({
    items: z.array(availabilitySlotSchema).max(500),
    count: z.number().int().min(0).max(500),
    generatedAt: z.iso.datetime(),
    videoPublishingEnabled: z.boolean(),
  })
  .strict()

export type SupportArea = z.infer<typeof supportAreaSchema>
export type SpecialistLanguage = z.infer<typeof specialistLanguageSchema>
export type SpecialistApprovalStatus = z.infer<
  typeof specialistApprovalStatusSchema
>
export type SpecialistDecisionReason = z.infer<
  typeof specialistDecisionReasonSchema
>
export type SpecialistProfileRequest = z.infer<
  typeof specialistProfileRequestSchema
>
export type SpecialistProfile = z.infer<typeof specialistProfileSchema>
export type AvailabilityModality = z.infer<typeof availabilityModalitySchema>
export type PublishAvailabilityRequest = z.infer<
  typeof publishAvailabilityRequestSchema
>
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>
export type AvailabilitySlotList = z.infer<typeof availabilitySlotListSchema>
