import { z } from 'zod'

const id = z.uuid()
const instant = z.iso.datetime({ offset: true })
const planCode = z.enum(['FREE', 'PLUS', 'PREMIUM'])
const provider = z.enum(['FAKE', 'MOMO', 'PAYOS'])
const pricingPolicy = z.enum(['upgrade-offset-v1', 'sandbox-full-price-v1'])

export const servicePlanSchema = z.strictObject({
  planVersionId: id,
  planCode,
  version: z.string().min(1).max(64),
  displayName: z.string().min(1).max(64),
  pricingPolicyVersion: pricingPolicy.optional(),
  currency: z.literal('VND'),
  priceVnd: z.number().int().nonnegative().safe(),
  billingPeriodMonths: z.literal(1),
  consultationCredits: z.union([z.literal(0), z.literal(4), z.literal(10)]),
  maxActiveReservations: z.union([z.literal(0), z.literal(2), z.literal(4)]),
  creditAllocationVnd: z.number().int().nonnegative().safe(),
  aiQuotaCode: z.string().min(1).max(64),
  supportPlanEnabled: z.boolean(),
  entitlements: z.array(z.string().min(1).max(64)),
  allowedUpgrades: z.array(z.enum(['PLUS', 'PREMIUM'])),
  effectiveFrom: instant,
})

export const servicePlanCatalogueSchema = z.strictObject({
  plans: z.array(servicePlanSchema).length(3),
  checkoutEnabled: z.boolean(),
  paymentProvider: provider,
  generatedAt: instant,
})

export const planPaymentSchema = z
  .strictObject({
    paymentId: id,
    subscriptionId: id,
    planVersionId: id,
    planCode: z.enum(['PLUS', 'PREMIUM']),
    planVersion: z.string().min(1).max(64),
    pricingPolicyVersion: pricingPolicy.optional(),
    purpose: z.enum(['PURCHASE', 'UPGRADE']),
    provider,
    status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CHARGEBACK']),
    terminalReason: z
      .enum(['EXPIRED', 'CANCELLED', 'PROVIDER_FAILED'])
      .nullable()
      .optional(),
    amountVnd: z.number().int().positive().safe(),
    currency: z.literal('VND'),
    checkoutUrl: z.url().startsWith('https://').nullable().optional(),
    qrCodeUrl: z.url().startsWith('https://').nullable().optional(),
    qrCode: z.string().min(1).nullable().optional(),
    bin: z.string().min(1).nullable().optional(),
    accountNumber: z.string().min(1).nullable().optional(),
    accountName: z.string().min(1).nullable().optional(),
    description: z.string().min(1).max(9).nullable().optional(),
    amount: z.number().int().positive().safe().nullable().optional(),
    expiredAt: instant.nullable().optional(),
    expiresAt: instant,
    createdAt: instant,
    paidAt: instant.nullable(),
    failedAt: instant.nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.amount !== undefined &&
      value.amount !== null &&
      value.amount !== value.amountVnd
    )
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'amount must match amountVnd',
      })
    if (value.expiredAt && value.expiredAt !== value.expiresAt)
      context.addIssue({
        code: 'custom',
        path: ['expiredAt'],
        message: 'expiredAt must match expiresAt',
      })
  })

export const paymentHistorySchema = z
  .strictObject({
    items: z.array(planPaymentSchema).max(50),
    count: z.number().int().min(0).max(50),
    generatedAt: instant,
  })
  .refine((value) => value.count === value.items.length)

export type ServicePlanCatalogue = z.infer<typeof servicePlanCatalogueSchema>
export type PlanPayment = z.infer<typeof planPaymentSchema>
