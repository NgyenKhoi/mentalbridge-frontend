import type { ReplaceSupportPlanOccurrenceEngagementRequest } from '@/features/support-plan/api/support-plan-contract'

const STATES = new Set(['SCHEDULED', 'COMPLETED', 'SKIPPED'])
const HELPFULNESS = new Set([
  'NOT_HELPFUL',
  'A_LITTLE_HELPFUL',
  'HELPFUL',
  'VERY_HELPFUL',
])
const BARRIERS = new Set([
  'LOW_ENERGY',
  'NOT_ENOUGH_TIME',
  'DIFFICULT_TO_START',
  'NOT_A_GOOD_FIT',
  'OTHER',
])
const ENGAGEMENT_FIELDS = [
  'state',
  'hidden',
  'helpfulness',
  'barrierCode',
  'reflection',
  'summaryReuseApproved',
] as const

/** Shared v1/v2 engagement body boundary; Care stays the state authority. */
export function parseEngagementRequest(value: unknown) {
  if (typeof value !== 'object' || value === null) return null
  const body = value as Record<string, unknown>
  const reflection = body.reflection
  if (
    Object.keys(body).some(
      (key) =>
        !ENGAGEMENT_FIELDS.includes(key as (typeof ENGAGEMENT_FIELDS)[number]),
    ) ||
    ENGAGEMENT_FIELDS.some((key) => !(key in body)) ||
    typeof body.state !== 'string' ||
    !STATES.has(body.state) ||
    typeof body.hidden !== 'boolean' ||
    typeof body.summaryReuseApproved !== 'boolean' ||
    !(
      body.helpfulness === null ||
      (typeof body.helpfulness === 'string' &&
        HELPFULNESS.has(body.helpfulness))
    ) ||
    !(
      body.barrierCode === null ||
      (typeof body.barrierCode === 'string' && BARRIERS.has(body.barrierCode))
    ) ||
    !(
      reflection === null ||
      (typeof reflection === 'string' &&
        reflection.trim().length > 0 &&
        reflection.length <= 500)
    ) ||
    (body.state === 'SCHEDULED' &&
      (body.helpfulness !== null ||
        body.barrierCode !== null ||
        reflection !== null ||
        body.summaryReuseApproved)) ||
    (body.state === 'COMPLETED' && body.barrierCode !== null) ||
    (body.state === 'SKIPPED' && body.helpfulness !== null)
  )
    return null
  return body as ReplaceSupportPlanOccurrenceEngagementRequest
}
