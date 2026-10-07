import { z } from 'zod'

export const tokenPairSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresIn: z.literal(900),
    refreshToken: z.string().min(43).max(512),
    refreshExpiresAt: z.iso.datetime(),
  })
  .strict()

const roleSchema = z.enum(['USER', 'SPECIALIST', 'ADMIN'])
const accountStatusSchema = z.enum([
  'PENDING_EMAIL_VERIFICATION',
  'ACTIVE',
  'DISABLED',
  'DELETION_PENDING',
  'DELETED',
])

export const accountDetailSchema = z
  .object({
    accountId: z.uuid(),
    email: z.email().max(254),
    status: accountStatusSchema,
    roles: z.array(roleSchema).length(1),
    emailVerified: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    version: z.number().int().nonnegative(),
  })
  .strict()

export const registrationResponseSchema = z
  .object({
    accountId: z.uuid(),
    status: z.literal('PENDING_EMAIL_VERIFICATION'),
    verificationRequired: z.literal(true),
    createdAt: z.iso.datetime(),
  })
  .strict()

export const accountSummarySchema = z
  .object({
    accountId: z.uuid(),
    status: accountStatusSchema,
    roles: z.array(roleSchema).length(1),
    emailVerified: z.boolean(),
  })
  .strict()

export type TokenPair = z.infer<typeof tokenPairSchema>
export type AccountDetail = z.infer<typeof accountDetailSchema>
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>

export type LoginRequest = Readonly<{
  email: string
  password: string
  deviceLabel?: string
}>

export type RegistrationRequest = Readonly<{
  email: string
  password: string
  actorType: 'USER'
  deviceLabel?: string
}>
