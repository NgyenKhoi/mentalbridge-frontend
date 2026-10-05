import type { AdministrationAuditSearch } from './identity-client'

const UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'
const TARGET_PATTERN = new RegExp(`^(account:${UUID}|tombstone:[0-9a-f]{64})$`)

const VALID_SOURCE_SERVICES = new Set([
  'IDENTITY',
  'CONSULTATION',
  'CONTENT',
  'COMMUNITY',
])

const VALID_DOMAINS = new Set([
  'ACCOUNT_ADMINISTRATION',
  'SPECIALIST_REVIEW',
  'RESOURCE_MANAGEMENT',
  'COMMUNITY_MODERATION',
])

export function administrationAuditSearch(
  search: URLSearchParams,
  includePagination: boolean,
): AdministrationAuditSearch | null {
  const allowed = new Set([
    'from',
    'to',
    'sourceService',
    'domain',
    'actorType',
    'action',
    'result',
    'targetIdentifier',
    ...(includePagination ? ['cursor', 'limit'] : []),
  ])
  if ([...search.keys()].some((key) => !allowed.has(key))) return null

  const from = search.get('from')
  const to = search.get('to')
  const sourceService = search.get('sourceService')
  const domain = search.get('domain')
  const actorType = search.get('actorType')
  const action = search.get('action')
  const result = search.get('result')
  const targetIdentifier = search.get('targetIdentifier')
  const cursor = search.get('cursor')
  const rawLimit = search.get('limit')
  const limit = rawLimit === null ? undefined : Number(rawLimit)

  if (
    (from !== null && !validDateTime(from)) ||
    (to !== null && !validDateTime(to)) ||
    (sourceService !== null && !VALID_SOURCE_SERVICES.has(sourceService)) ||
    (domain !== null && !VALID_DOMAINS.has(domain)) ||
    (actorType !== null && !['ADMIN', 'SYSTEM'].includes(actorType)) ||
    (action !== null && !/^[A-Z0-9_]{1,96}$/.test(action)) ||
    (result !== null && !['SUCCEEDED', 'DENIED', 'FAILED'].includes(result)) ||
    (targetIdentifier !== null && !TARGET_PATTERN.test(targetIdentifier)) ||
    (cursor !== null && (cursor.length < 1 || cursor.length > 512)) ||
    (limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 100))
  ) {
    return null
  }

  return {
    ...(from === null ? {} : { from }),
    ...(to === null ? {} : { to }),
    ...(sourceService === null ? {} : { sourceService }),
    ...(domain === null ? {} : { domain }),
    ...(actorType === null ? {} : { actorType }),
    ...(action === null ? {} : { action }),
    ...(result === null ? {} : { result }),
    ...(targetIdentifier === null ? {} : { targetIdentifier }),
    ...(cursor === null ? {} : { cursor }),
    ...(limit === undefined ? {} : { limit }),
  }
}

function validDateTime(value: string) {
  return value.length <= 40 && Number.isFinite(Date.parse(value))
}
