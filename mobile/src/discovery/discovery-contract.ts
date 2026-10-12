import { z } from 'zod'

import {
  availabilityModalitySchema,
  specialistLanguageSchema,
  supportAreaSchema,
} from '@/specialist/specialist-contract'

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
const instant = z.iso.datetime({ offset: true })
const unique = <T>(items: T[]) => new Set(items).size === items.length
export const discoveryCriteriaSchema = z.strictObject({
  supportArea: supportAreaSchema.optional(),
  language: specialistLanguageSchema.optional(),
  modality: availabilityModalitySchema.optional(),
  timezone: timezone.optional(),
})
export const discoverySlotSchema = z
  .strictObject({
    id: z.uuid(),
    specialistAccountId: z.uuid(),
    startAt: instant,
    endAt: instant,
    timezone,
    modality: availabilityModalitySchema,
    version: z.number().int().nonnegative().safe(),
  })
  .refine(
    (slot) => Date.parse(slot.endAt) - Date.parse(slot.startAt) === 3_600_000,
  )
export const discoveryExplanationSchema = z.strictObject({
  compatibility: z.enum(['NEUTRAL', 'MATCHED', 'NOT_MATCHED', 'UNAVAILABLE']),
  languageMatched: z.boolean().nullable(),
  hasSelectableSlot: z.boolean(),
  earliestSelectableStartAt: instant.nullable(),
  timezoneMatch: z.enum(['NOT_REQUESTED', 'EXACT', 'OFFSET_DISTANCE']),
  timezoneOffsetDistanceMinutes: z.number().int().min(0).max(1440).nullable(),
  ratingTieBreakerApplied: z.boolean(),
  codes: z
    .array(
      z.enum([
        'SCREENED_SUPPORT_AREA_MATCH',
        'NO_SCREENED_SUPPORT_AREA_MATCH',
        'NO_SCREENING_CONTEXT',
        'SCREENING_CONTEXT_UNAVAILABLE',
        'REQUESTED_LANGUAGE_MATCH',
        'REQUESTED_LANGUAGE_NOT_MATCHED',
        'NO_REQUESTED_LANGUAGE',
        'SELECTABLE_SLOT_AVAILABLE',
        'NO_SELECTABLE_SLOT',
        'EXACT_TIMEZONE_MATCH',
        'TIMEZONE_OFFSET_DISTANCE',
        'NO_REQUESTED_TIMEZONE',
        'RATING_AVAILABLE',
        'RATING_NOT_AVAILABLE',
      ]),
    )
    .min(4)
    .max(5)
    .refine(unique),
})
export const discoveryItemSchema = z
  .strictObject({
    specialistAccountId: z.uuid(),
    displayName: z.string().min(1).max(120),
    bio: z.string().min(1).max(2000),
    supportAreas: z.array(supportAreaSchema).min(1).max(2).refine(unique),
    languages: z.array(specialistLanguageSchema).min(1).max(2).refine(unique),
    yearsOfExperience: z.number().int().min(0).max(80),
    timezone,
    ratingAggregate: z
      .strictObject({
        averageRating: z.number().min(1).max(5).multipleOf(0.01),
        ratingCount: z.number().int().positive().safe(),
      })
      .nullable(),
    explanation: discoveryExplanationSchema,
    selectableSlots: z
      .array(discoverySlotSchema)
      .min(1)
      .max(20)
      .refine((slots) => unique(slots.map((slot) => slot.id))),
  })
  .refine((item) =>
    item.selectableSlots.every(
      (slot) => slot.specialistAccountId === item.specialistAccountId,
    ),
  )
export const discoveryPageSchema = z
  .strictObject({
    items: z.array(discoveryItemSchema).max(50),
    count: z.number().int().min(0).max(50),
    nextCursor: z.string().min(1).max(2048).nullable(),
    rankingPolicyVersion: z.literal('specialist-discovery-v2'),
    generatedAt: instant,
    contextState: z.enum(['NOT_REQUESTED', 'APPLIED', 'UNAVAILABLE']),
    packageCode: z.enum(['FREE', 'PLUS', 'PREMIUM']),
    bookingHandoff: z.enum(['BROWSE_ONLY', 'BOOKING_POLICY_CHECK_REQUIRED']),
    videoEnabled: z.boolean(),
  })
  .refine(
    (page) =>
      page.count === page.items.length &&
      unique(page.items.map((item) => item.specialistAccountId)) &&
      (page.videoEnabled ||
        page.items.every((item) =>
          item.selectableSlots.every((slot) => slot.modality === 'IN_APP_CHAT'),
        )),
  )

export type DiscoveryCriteria = z.infer<typeof discoveryCriteriaSchema>
export type DiscoveryItem = z.infer<typeof discoveryItemSchema>
export type DiscoveryPage = z.infer<typeof discoveryPageSchema>
export type DiscoverySlot = z.infer<typeof discoverySlotSchema>
