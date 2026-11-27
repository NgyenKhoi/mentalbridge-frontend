import { z } from 'zod'

export const careProfileSchema = z
  .object({
    accountId: z.uuid(),
    displayName: z.string().min(1).max(120),
    dateOfBirth: z.iso.date().nullable().optional(),
    gender: z.string().min(1).max(32).nullable().optional(),
    locale: z.string().min(2).max(16),
    timezone: z.string().min(1).max(64),
    reminderEnabled: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    version: z.number().int().nonnegative(),
  })
  .strict()

export const careProfileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    dateOfBirth: z.iso.date().nullable().optional(),
    gender: z.string().min(1).max(32).nullable().optional(),
  })
  .strict()

export type CareProfile = z.infer<typeof careProfileSchema>
export type CareProfileUpdate = z.infer<typeof careProfileUpdateSchema>
