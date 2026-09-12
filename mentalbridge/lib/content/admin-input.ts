import { z } from 'zod'

export const RESOURCE_BODY_LIMIT = 70 * 1024

const locale = z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
const httpUrl = z.url().refine((value) => {
  const url = new URL(value)
  return (
    ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  )
})
const nullableDate = z.iso.datetime({ offset: true }).nullable().optional()

function validDates(value: {
  effectiveAt?: string | null
  expiresAt?: string | null
}) {
  return (
    !value.effectiveAt ||
    !value.expiresAt ||
    Date.parse(value.effectiveAt) < Date.parse(value.expiresAt)
  )
}

export const createResourceSchema = z
  .object({
    category: z.enum([
      'BREATHING',
      'MEDITATION',
      'ARTICLE',
      'VIDEO',
      'JOURNALING',
      'COMMUNITY',
    ]),
    locale: locale.default('vi-VN'),
    title: z.string().min(1).max(255),
    summary: z.string().min(1),
    contentBody: z.string().min(1).nullable().optional(),
    externalUrl: httpUrl.nullable().optional(),
    effectiveAt: nullableDate,
    expiresAt: nullableDate,
  })
  .strict()
  .refine((value) => Boolean(value.contentBody || value.externalUrl), {
    path: ['contentBody'],
  })
  .refine(validDates, { path: ['effectiveAt'] })

export const updateResourceSchema = z
  .object({
    locale: locale.optional(),
    title: z.string().min(1).max(255).optional(),
    summary: z.string().min(1).optional(),
    contentBody: z.string().min(1).nullable().optional(),
    externalUrl: httpUrl.nullable().optional(),
    effectiveAt: nullableDate,
    expiresAt: nullableDate,
  })
  .strict()
  .refine(
    (value) => !(value.contentBody === null && value.externalUrl === null),
    {
      path: ['contentBody'],
    },
  )
  .refine(validDates, { path: ['effectiveAt'] })

export const listResourceQuerySchema = z
  .object({
    locale: locale.optional(),
    category: z
      .enum([
        'BREATHING',
        'MEDITATION',
        'ARTICLE',
        'VIDEO',
        'JOURNALING',
        'COMMUNITY',
      ])
      .optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.uuid().optional(),
  })
  .strict()

export function queryObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

export function versionFrom(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('version')
  if (!raw || !/^\d+$/.test(raw)) return null
  const version = Number(raw)
  return Number.isSafeInteger(version) ? version : null
}

export function zodViolations(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    code: 'INVALID_VALUE',
  }))
}
