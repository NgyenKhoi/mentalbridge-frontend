import type { components } from '@/contracts/content.generated'

export type ResourceSummary = components['schemas']['ResourceSummary']
export type AdminResourceDetail = components['schemas']['AdminResourceDetail']
export type ResourceListResponse = components['schemas']['ResourceListResponse']

const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const CATEGORIES = new Set([
  'BREATHING',
  'MEDITATION',
  'ARTICLE',
  'VIDEO',
  'JOURNALING',
  'COMMUNITY',
])
const STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED'])

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function dateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function nullableDateTime(value: unknown): value is string | null {
  return value === null || dateTime(value)
}

function nullableHttpUrl(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

function optionalNullableDateTime(value: unknown): boolean {
  return value === undefined || nullableDateTime(value)
}

function optionalNullableHttpUrl(value: unknown): boolean {
  return value === undefined || nullableHttpUrl(value)
}

function optionalDateTime(value: unknown): boolean {
  return value === undefined || dateTime(value)
}

export function isResourceId(value: string): boolean {
  return UUID.test(value)
}

export function isLocale(value: string): boolean {
  return LOCALE.test(value)
}

export function isIdempotencyKey(value: string | null): value is string {
  return value !== null && /^[A-Za-z0-9_-]{1,128}$/.test(value)
}

export function parseResourceSummary(value: unknown): ResourceSummary | null {
  const item = record(value)
  if (
    !item ||
    typeof item.id !== 'string' ||
    !UUID.test(item.id) ||
    typeof item.category !== 'string' ||
    !CATEGORIES.has(item.category) ||
    typeof item.locale !== 'string' ||
    !LOCALE.test(item.locale) ||
    typeof item.title !== 'string' ||
    typeof item.summary !== 'string' ||
    !optionalNullableHttpUrl(item.externalUrl) ||
    typeof item.status !== 'string' ||
    !STATUSES.has(item.status) ||
    !optionalNullableDateTime(item.reviewedAt) ||
    !dateTime(item.createdAt) ||
    !optionalDateTime(item.updatedAt)
  ) {
    return null
  }
  return item as ResourceSummary
}

export function parseAdminResourceDetail(
  value: unknown,
): AdminResourceDetail | null {
  const summary = parseResourceSummary(value)
  const item = record(value)
  if (
    !summary ||
    !item ||
    !(item.contentBody === null || typeof item.contentBody === 'string') ||
    !(
      item.reviewedBy === null ||
      (typeof item.reviewedBy === 'string' && UUID.test(item.reviewedBy))
    ) ||
    !nullableDateTime(item.effectiveAt) ||
    !nullableDateTime(item.expiresAt) ||
    !Number.isSafeInteger(item.version) ||
    (item.version as number) < 0
  ) {
    return null
  }
  return item as AdminResourceDetail
}

export function parseResourceList(value: unknown): ResourceListResponse | null {
  const page = record(value)
  if (
    !page ||
    !Array.isArray(page.data) ||
    !page.data.every((item) => parseResourceSummary(item) !== null) ||
    !Number.isSafeInteger(page.count) ||
    (page.count as number) < 0 ||
    !(
      page.nextCursor === undefined ||
      (typeof page.nextCursor === 'string' && UUID.test(page.nextCursor))
    )
  ) {
    return null
  }
  return page as ResourceListResponse
}

export type ContentProblem = Readonly<{
  type: string
  title: string
  status: number
  code: string
  correlationId?: string | null
  fieldViolations?: readonly { field: string; message: string }[]
}>

export function parseContentProblem(
  value: unknown,
  status: number,
): ContentProblem | null {
  const problem = record(value)
  if (
    !problem ||
    problem.status !== status ||
    typeof problem.type !== 'string' ||
    typeof problem.title !== 'string' ||
    typeof problem.code !== 'string' ||
    !/^[A-Z0-9_]{1,64}$/.test(problem.code) ||
    !(
      problem.correlationId === undefined ||
      problem.correlationId === null ||
      (typeof problem.correlationId === 'string' &&
        UUID.test(problem.correlationId))
    )
  ) {
    return null
  }
  if (problem.fieldViolations !== undefined) {
    if (
      !Array.isArray(problem.fieldViolations) ||
      !problem.fieldViolations.every((entry) => {
        const violation = record(entry)
        return (
          violation !== null &&
          typeof violation.field === 'string' &&
          /^[A-Za-z0-9_.-]{1,128}$/.test(violation.field) &&
          typeof violation.message === 'string' &&
          violation.message.length <= 300
        )
      })
    ) {
      return null
    }
  }
  return problem as ContentProblem
}
