import type {
  ResourceCategory,
  ResourceListResponse,
  ResourceSummary,
} from '@/features/resources/api/content-contract'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CATEGORIES = new Set<ResourceCategory>([
  'BREATHING',
  'MEDITATION',
  'ARTICLE',
  'VIDEO',
  'JOURNALING',
  'COMMUNITY',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseResource(value: unknown): ResourceSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !UUID_PATTERN.test(value.id) ||
    !CATEGORIES.has(value.category as ResourceCategory) ||
    typeof value.locale !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    value.status !== 'PUBLISHED' ||
    !isDateTime(value.reviewedAt) ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt) ||
    !(
      value.externalUrl === undefined ||
      value.externalUrl === null ||
      typeof value.externalUrl === 'string'
    )
  ) {
    return null
  }

  return value as ResourceSummary
}

export function parseResourceList(value: unknown): ResourceListResponse | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.data) ||
    !Number.isInteger(value.count) ||
    Number(value.count) < 0 ||
    Number(value.count) !== value.data.length ||
    !(
      value.nextCursor === undefined ||
      (typeof value.nextCursor === 'string' &&
        UUID_PATTERN.test(value.nextCursor))
    )
  ) {
    return null
  }

  if (value.fallback === 'unavailable') {
    if (value.data.length !== 0 || typeof value.message !== 'string')
      return null
    return value as ResourceListResponse
  }
  if (value.fallback !== undefined || value.message !== undefined) return null

  const resources = value.data.map(parseResource)
  if (resources.some((resource) => resource === null)) return null
  return {
    ...value,
    data: resources as ResourceSummary[],
    count: Number(value.count),
  }
}
