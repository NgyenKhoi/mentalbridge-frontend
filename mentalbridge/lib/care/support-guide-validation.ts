import type {
  SupportGuide,
  SupportGuideHistory,
} from '@/features/support-guide/api/support-guide-contract'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const statuses = new Set([
  'AVAILABLE',
  'PARTIAL',
  'EMPTY',
  'STALE',
  'UNAVAILABLE',
])

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = new Set(allowed)
  return Object.keys(value).every((key) => keys.has(key))
}

function safeExternalUrl(value: unknown) {
  if (value === null || value === undefined) return true
  if (typeof value !== 'string' || value.length > 2048) return false
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

export function parseSupportGuide(value: unknown): SupportGuide | null {
  const guide = object(value)
  const explanation = object(guide?.explanation)
  const safety = object(guide?.safety)
  const resolution = object(guide?.resourceResolution)
  const provenance = object(guide?.provenance)
  const phrasing = object(guide?.phrasing)
  if (
    !guide ||
    !onlyKeys(guide, [
      'supportGuideId',
      'guideVersion',
      'guidePolicyVersion',
      'supportEvaluationId',
      'generatedAt',
      'guideType',
      'explanation',
      'safety',
      'resourceResolution',
      'resources',
      'provenance',
      'phrasing',
    ]) ||
    typeof guide.supportGuideId !== 'string' ||
    !UUID.test(guide.supportGuideId) ||
    guide.guideVersion !== 1 ||
    guide.guidePolicyVersion !== 'mb-support-guide-capstone-v1' ||
    typeof guide.supportEvaluationId !== 'string' ||
    !UUID.test(guide.supportEvaluationId) ||
    typeof guide.generatedAt !== 'string' ||
    Number.isNaN(Date.parse(guide.generatedAt)) ||
    guide.guideType !== 'ONE_TIME_SUPPORT_GUIDE' ||
    !explanation ||
    !onlyKeys(explanation, ['code', 'text']) ||
    typeof explanation?.code !== 'string' ||
    typeof explanation.text !== 'string' ||
    !safety ||
    !onlyKeys(safety, [
      'status',
      'reasonCode',
      'policyVersion',
      'guidanceCode',
      'guidance',
    ]) ||
    !['NEGATIVE_SAFETY_SCREEN', 'POSITIVE_SAFETY_SCREEN'].includes(
      String(safety?.status),
    ) ||
    typeof safety?.reasonCode !== 'string' ||
    typeof safety.policyVersion !== 'string' ||
    typeof safety.guidanceCode !== 'string' ||
    typeof safety.guidance !== 'string' ||
    !resolution ||
    !onlyKeys(resolution, ['status', 'policyVersion', 'resolvedAt']) ||
    !statuses.has(String(resolution?.status)) ||
    typeof resolution?.policyVersion !== 'string' ||
    typeof resolution.resolvedAt !== 'string' ||
    Number.isNaN(Date.parse(resolution.resolvedAt)) ||
    !Array.isArray(guide.resources) ||
    guide.resources.length > 4 ||
    !provenance ||
    !onlyKeys(provenance, [
      'supportEvaluationPolicyVersion',
      'assessmentResults',
    ]) ||
    typeof provenance?.supportEvaluationPolicyVersion !== 'string' ||
    !Array.isArray(provenance.assessmentResults) ||
    provenance.assessmentResults.length !== 2 ||
    !phrasing ||
    !onlyKeys(phrasing, ['source', 'status']) ||
    phrasing?.source !== 'CARE_APPROVED_STANDARD' ||
    !['STANDARD', 'AI_UNAVAILABLE_FALLBACK'].includes(String(phrasing.status))
  )
    return null

  for (const candidate of guide.resources) {
    const resource = object(candidate)
    if (
      !resource ||
      !onlyKeys(resource, [
        'resourceId',
        'contentVersion',
        'publicationId',
        'domain',
        'role',
        'category',
        'title',
        'summary',
        'externalUrl',
      ]) ||
      typeof resource?.resourceId !== 'string' ||
      !UUID.test(resource.resourceId) ||
      typeof resource.contentVersion !== 'string' ||
      typeof resource.publicationId !== 'string' ||
      !UUID.test(resource.publicationId) ||
      !['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'].includes(
        String(resource.domain),
      ) ||
      !['PRIMARY', 'ADJUNCT'].includes(String(resource.role)) ||
      typeof resource.category !== 'string' ||
      typeof resource.title !== 'string' ||
      resource.title.length === 0 ||
      resource.title.length > 255 ||
      typeof resource.summary !== 'string' ||
      resource.summary.length === 0 ||
      !safeExternalUrl(resource.externalUrl)
    )
      return null
  }
  for (const candidate of provenance.assessmentResults) {
    const evidence = object(candidate)
    if (
      !evidence ||
      !onlyKeys(evidence, [
        'assessmentId',
        'instrument',
        'questionnaireVersion',
        'scoringVersion',
        'screeningLevel',
      ]) ||
      typeof evidence?.assessmentId !== 'string' ||
      !UUID.test(evidence.assessmentId) ||
      !['PHQ9', 'GAD7'].includes(String(evidence.instrument)) ||
      typeof evidence.questionnaireVersion !== 'string' ||
      typeof evidence.scoringVersion !== 'string' ||
      typeof evidence.screeningLevel !== 'string'
    )
      return null
  }
  return value as SupportGuide
}

export function parseSupportGuideHistory(
  value: unknown,
): SupportGuideHistory | null {
  const history = object(value)
  if (
    !history ||
    !onlyKeys(history, ['items', 'nextCursor', 'hasMore']) ||
    !Array.isArray(history.items) ||
    typeof history.hasMore !== 'boolean' ||
    !(
      history.nextCursor === null ||
      history.nextCursor === undefined ||
      typeof history.nextCursor === 'string'
    )
  )
    return null
  const items = history.items.map(parseSupportGuide)
  if (items.some((item) => item === null)) return null
  return { ...history, items } as SupportGuideHistory
}
