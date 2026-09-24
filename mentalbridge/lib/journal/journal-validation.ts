import type {
  AnalysisJob,
  AnalysisResult,
  AnalysisTerminalReason,
  JournalCreate,
  JournalEntry,
  JournalMood,
  JournalPage,
  JournalTombstone,
  JournalWrite,
  CreateLongitudinalAnalysisRequest,
  LongitudinalAnalysisJob,
} from './journal-contract'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const rfc3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const moods = new Set<JournalMood>(['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'])
const analysisStatuses = new Set(['RUNNING', 'SUCCEEDED', 'FAILED'])
const terminalReasons = new Set<AnalysisTerminalReason>([
  'CONSENT_REQUIRED',
  'CONSENT_REVOKED',
  'CONSENT_UNAVAILABLE',
  'ENTITLEMENT_UNAVAILABLE',
  'ENTITLEMENT_CHANGED',
  'AUTHORIZATION_CONTEXT_LOST',
  'REVISION_STALE',
  'JOURNAL_DELETED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'INVALID_PROVIDER_RESULT',
  'INTERNAL_ERROR',
])
const suggestedActions = new Set([
  'NONE',
  'OFFER_RESOURCE_EXPLANATION',
  'GUIDE_APPROVED_ACTIVITY',
  'REQUEST_ALLOWED_ALTERNATIVE',
  'REQUEST_PLAN_REVIEW',
  'OPEN_PROFESSIONAL_SUPPORT',
  'OPEN_SAFETY_GUIDANCE',
])
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const dateTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  rfc3339.test(value) &&
  !Number.isNaN(Date.parse(value))
const tags = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 20 &&
  value.every(
    (tag) =>
      typeof tag === 'string' &&
      tag.trim() === tag &&
      tag.length > 0 &&
      tag.length <= 40,
  ) &&
  new Set(value).size === value.length
export const isJournalMood = (value: unknown): value is JournalMood =>
  typeof value === 'string' && moods.has(value as JournalMood)

export const isJournalId = (value: unknown): value is string =>
  typeof value === 'string' && uuid.test(value)
export const isIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 16 && value.length <= 128
export const isJournalRevision = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 200

const longitudinalPeriod = (value: unknown) =>
  object(value) &&
  exact(value, ['startAt', 'endAt']) &&
  dateTime(value.startAt) &&
  dateTime(value.endAt) &&
  Date.parse(value.startAt) < Date.parse(value.endAt)

const longitudinalCoverage = (value: unknown) =>
  object(value) &&
  exact(value, [
    'previousPeriodJournalEntryCount',
    'currentPeriodJournalEntryCount',
    'sufficientForComparison',
  ]) &&
  Number.isInteger(value.previousPeriodJournalEntryCount) &&
  Number(value.previousPeriodJournalEntryCount) >= 0 &&
  Number.isInteger(value.currentPeriodJournalEntryCount) &&
  Number(value.currentPeriodJournalEntryCount) >= 0 &&
  typeof value.sufficientForComparison === 'boolean'

const longitudinalSources = (value: unknown) =>
  Array.isArray(value) &&
  value.length <= 200 &&
  value.every(
    (source) =>
      object(source) &&
      exact(source, ['journalId', 'journalRevision', 'period']) &&
      isJournalId(source.journalId) &&
      isJournalRevision(source.journalRevision) &&
      ['PREVIOUS', 'CURRENT'].includes(String(source.period)),
  )

const longitudinalEvidence = (value: unknown) =>
  object(value) &&
  exact(value, [
    'analysisId',
    'previousPeriod',
    'currentPeriod',
    'sourceJournalRevisions',
    'contextSignals',
    'emotionIndicators',
    'recurringThemes',
    'changesComparedWithPreviousPeriod',
    'preferences',
    'barriers',
    'helpfulPatterns',
    'dataCoverage',
    'provider',
    'model',
    'promptVersion',
    'schemaVersion',
    'createdAt',
  ]) &&
  isJournalId(value.analysisId) &&
  longitudinalPeriod(value.previousPeriod) &&
  longitudinalPeriod(value.currentPeriod) &&
  longitudinalSources(value.sourceJournalRevisions) &&
  boundedStrings(value.contextSignals) &&
  boundedStrings(value.emotionIndicators) &&
  boundedStrings(value.recurringThemes) &&
  Array.isArray(value.changesComparedWithPreviousPeriod) &&
  value.changesComparedWithPreviousPeriod.length <= 24 &&
  value.changesComparedWithPreviousPeriod.every(
    (change) =>
      object(change) &&
      exact(change, ['signal', 'direction']) &&
      boundedString(change.signal, 64) &&
      [
        'MORE_FREQUENT',
        'LESS_FREQUENT',
        'SIMILAR',
        'INSUFFICIENT_DATA',
      ].includes(String(change.direction)),
  ) &&
  boundedStrings(value.preferences) &&
  boundedStrings(value.barriers) &&
  boundedStrings(value.helpfulPatterns) &&
  longitudinalCoverage(value.dataCoverage) &&
  ['DETERMINISTIC_FAKE', 'GEMINI', 'OPENAI'].includes(String(value.provider)) &&
  boundedString(value.model, 128) &&
  value.promptVersion === 'longitudinal-v1' &&
  value.schemaVersion === 1 &&
  dateTime(value.createdAt)

export function parseCreateLongitudinalAnalysisRequest(
  value: unknown,
): CreateLongitudinalAnalysisRequest | null {
  if (
    !object(value) ||
    !exact(value, ['previousPeriod', 'currentPeriod', 'excludedJournalIds']) ||
    !longitudinalPeriod(value.previousPeriod) ||
    !longitudinalPeriod(value.currentPeriod) ||
    !Array.isArray(value.excludedJournalIds) ||
    value.excludedJournalIds.length > 200 ||
    !value.excludedJournalIds.every(isJournalId) ||
    new Set(value.excludedJournalIds).size !== value.excludedJournalIds.length
  )
    return null
  return value as CreateLongitudinalAnalysisRequest
}

export function parseLongitudinalAnalysisJob(
  value: unknown,
): LongitudinalAnalysisJob | null {
  if (
    !object(value) ||
    !exact(value, [
      'jobId',
      'previousPeriod',
      'currentPeriod',
      'sourceJournalRevisions',
      'dataCoverage',
      'status',
      'attemptCount',
      'terminalReason',
      'result',
      'createdAt',
      'updatedAt',
      'completedAt',
    ]) ||
    !isJournalId(value.jobId) ||
    !longitudinalPeriod(value.previousPeriod) ||
    !longitudinalPeriod(value.currentPeriod) ||
    !longitudinalSources(value.sourceJournalRevisions) ||
    !longitudinalCoverage(value.dataCoverage) ||
    !analysisStatuses.has(String(value.status)) ||
    !Number.isInteger(value.attemptCount) ||
    Number(value.attemptCount) < 0 ||
    Number(value.attemptCount) > 2 ||
    !dateTime(value.createdAt) ||
    !dateTime(value.updatedAt) ||
    (value.completedAt !== null && !dateTime(value.completedAt))
  )
    return null
  const terminal = value.terminalReason ?? null
  const result = value.result
  const longitudinalTerminalReasons = [
    'CONSENT_REQUIRED',
    'CONSENT_REVOKED',
    'CONSENT_UNAVAILABLE',
    'ENTITLEMENT_UNAVAILABLE',
    'ENTITLEMENT_CHANGED',
    'AUTHORIZATION_CONTEXT_LOST',
    'SOURCE_REVISION_CHANGED',
    'SOURCE_DELETED',
    'PROVIDER_TIMEOUT',
    'PROVIDER_UNAVAILABLE',
    'INVALID_PROVIDER_RESULT',
    'INTERNAL_ERROR',
  ]
  if (
    (value.status === 'RUNNING' &&
      (terminal !== null || result !== null || value.completedAt !== null)) ||
    (value.status === 'SUCCEEDED' &&
      (terminal !== null ||
        !longitudinalEvidence(result) ||
        value.completedAt === null)) ||
    (value.status === 'FAILED' &&
      (typeof terminal !== 'string' ||
        !longitudinalTerminalReasons.includes(terminal) ||
        result !== null ||
        value.completedAt === null))
  )
    return null
  return value as LongitudinalAnalysisJob
}

const boundedStrings = (value: unknown) =>
  Array.isArray(value) &&
  value.length <= 12 &&
  value.every(
    (item) => typeof item === 'string' && item.length >= 1 && item.length <= 64,
  )

function parseAnalysisResult(value: unknown): AnalysisResult | null {
  if (
    !object(value) ||
    !exact(value, [
      'summary',
      'contextSignals',
      'emotionIndicators',
      'themes',
      'preferenceSignals',
      'barrierSignals',
      'sentiment',
      'modelConfidence',
      'suggestedAction',
      'workload',
      'servicePlan',
      'entitlementSource',
      'entitlementPolicyVersion',
      'entitlementVersion',
      'routingPolicyVersion',
      'providerApprovalVersion',
      'provider',
      'model',
      'promptVersion',
      'schemaVersion',
      'latencyMs',
      'inputTokens',
      'outputTokens',
      'estimatedCostMicroUsd',
      'createdAt',
    ]) ||
    (value.summary !== undefined &&
      (typeof value.summary !== 'string' ||
        value.summary.length < 1 ||
        value.summary.length > 800)) ||
    !boundedStrings(value.contextSignals) ||
    !boundedStrings(value.emotionIndicators) ||
    !boundedStrings(value.themes) ||
    !boundedStrings(value.preferenceSignals) ||
    !boundedStrings(value.barrierSignals) ||
    (value.sentiment !== undefined &&
      (typeof value.sentiment !== 'string' ||
        value.sentiment.length < 1 ||
        value.sentiment.length > 32)) ||
    (value.modelConfidence !== undefined &&
      (typeof value.modelConfidence !== 'number' ||
        value.modelConfidence < 0 ||
        value.modelConfidence > 1)) ||
    typeof value.suggestedAction !== 'string' ||
    !suggestedActions.has(value.suggestedAction) ||
    (value.workload !== undefined && value.workload !== 'EXACT_REVISION') ||
    (value.servicePlan !== undefined &&
      !['FREE', 'PLUS', 'PREMIUM'].includes(String(value.servicePlan))) ||
    (value.entitlementSource !== undefined &&
      !['DEFAULT_FREE', 'DEMO', 'PAID'].includes(
        String(value.entitlementSource),
      )) ||
    !optionalBoundedString(value.entitlementPolicyVersion, 96) ||
    !optionalNonNegativeInteger(value.entitlementVersion) ||
    !optionalBoundedString(value.routingPolicyVersion, 96) ||
    !optionalBoundedString(value.providerApprovalVersion, 96) ||
    !['DETERMINISTIC_FAKE', 'GEMINI', 'OPENAI'].includes(
      String(value.provider),
    ) ||
    !boundedString(value.model, 128) ||
    !boundedString(value.promptVersion, 96) ||
    value.schemaVersion !== 1 ||
    !optionalNonNegativeInteger(value.latencyMs) ||
    !optionalNullableNonNegativeInteger(value.inputTokens) ||
    !optionalNullableNonNegativeInteger(value.outputTokens) ||
    !optionalNullableNonNegativeInteger(value.estimatedCostMicroUsd) ||
    !dateTime(value.createdAt)
  )
    return null
  return value as AnalysisResult
}

const boundedString = (value: unknown, maximum: number) =>
  typeof value === 'string' && value.length >= 1 && value.length <= maximum
const optionalBoundedString = (value: unknown, maximum: number) =>
  value === undefined || boundedString(value, maximum)
const optionalNonNegativeInteger = (value: unknown) =>
  value === undefined || (Number.isInteger(value) && Number(value) >= 0)
const optionalNullableNonNegativeInteger = (value: unknown) =>
  value === undefined || value === null || optionalNonNegativeInteger(value)

export function parseAnalysisJob(value: unknown): AnalysisJob | null {
  if (
    !object(value) ||
    !exact(value, [
      'jobId',
      'journalId',
      'journalRevision',
      'status',
      'attemptCount',
      'terminalReason',
      'result',
      'createdAt',
      'updatedAt',
      'completedAt',
    ]) ||
    !isJournalId(value.jobId) ||
    !isJournalId(value.journalId) ||
    !isJournalRevision(value.journalRevision) ||
    typeof value.status !== 'string' ||
    !analysisStatuses.has(value.status) ||
    !Number.isInteger(value.attemptCount) ||
    Number(value.attemptCount) < 0 ||
    Number(value.attemptCount) > 2 ||
    (value.terminalReason !== undefined &&
      value.terminalReason !== null &&
      (typeof value.terminalReason !== 'string' ||
        !terminalReasons.has(
          value.terminalReason as AnalysisTerminalReason,
        ))) ||
    (value.result !== undefined &&
      value.result !== null &&
      !parseAnalysisResult(value.result)) ||
    !dateTime(value.createdAt) ||
    !dateTime(value.updatedAt) ||
    (value.completedAt !== undefined &&
      value.completedAt !== null &&
      !dateTime(value.completedAt))
  )
    return null
  const terminalReason = value.terminalReason ?? null
  const result = value.result ?? null
  const completedAt = value.completedAt ?? null
  if (
    (value.status === 'RUNNING' &&
      (terminalReason !== null || result !== null || completedAt !== null)) ||
    (value.status === 'SUCCEEDED' &&
      (terminalReason !== null || result === null || completedAt === null)) ||
    (value.status === 'FAILED' &&
      (terminalReason === null || result !== null || completedAt === null))
  )
    return null
  return value as AnalysisJob
}

function metadata(value: Record<string, unknown>) {
  return (
    isJournalId(value.id) &&
    isJournalId(value.ownerAccountId) &&
    Number.isInteger(value.currentRevision) &&
    Number(value.currentRevision) >= 1 &&
    dateTime(value.occurredAt) &&
    dateTime(value.createdAt) &&
    dateTime(value.updatedAt) &&
    value.deleted === false &&
    tags(value.tags) &&
    (value.mood === null || isJournalMood(value.mood)) &&
    object(value.encryption) &&
    exact(value.encryption, ['algorithm', 'keyId', 'encryptedAt']) &&
    value.encryption.algorithm === 'AES-256-GCM' &&
    typeof value.encryption.keyId === 'string' &&
    value.encryption.keyId.length > 0 &&
    dateTime(value.encryption.encryptedAt) &&
    ['not_requested', 'current', 'stale'].includes(String(value.analysisState))
  )
}

export function parseJournalEntry(value: unknown): JournalEntry | null {
  if (
    !object(value) ||
    !exact(value, [
      'id',
      'ownerAccountId',
      'currentRevision',
      'occurredAt',
      'createdAt',
      'updatedAt',
      'deleted',
      'tags',
      'mood',
      'encryption',
      'analysisState',
      'content',
    ]) ||
    !metadata(value) ||
    !object(value.content)
  )
    return null
  if (
    !exact(value.content, ['text', 'byteLength']) ||
    typeof value.content.text !== 'string' ||
    value.content.text.length < 1 ||
    value.content.text.length > 12_000 ||
    !Number.isInteger(value.content.byteLength) ||
    Number(value.content.byteLength) < 1
  )
    return null
  if (
    new TextEncoder().encode(value.content.text).byteLength !==
    value.content.byteLength
  )
    return null
  return value as JournalEntry
}

export function parseJournalPage(value: unknown): JournalPage | null {
  if (
    !object(value) ||
    !exact(value, ['items', 'page']) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    !object(value.page)
  )
    return null
  if (
    !exact(value.page, ['limit', 'hasMore', 'nextCursor']) ||
    !Number.isInteger(value.page.limit) ||
    Number(value.page.limit) < 1 ||
    Number(value.page.limit) > 50 ||
    typeof value.page.hasMore !== 'boolean' ||
    (value.page.nextCursor !== undefined &&
      (typeof value.page.nextCursor !== 'string' ||
        value.page.nextCursor.length < 1 ||
        value.page.nextCursor.length > 512))
  )
    return null
  const items = value.items.map((item) => {
    if (
      !object(item) ||
      !exact(item, [
        'id',
        'ownerAccountId',
        'currentRevision',
        'occurredAt',
        'createdAt',
        'updatedAt',
        'deleted',
        'tags',
        'mood',
        'encryption',
        'analysisState',
        'content',
      ]) ||
      !metadata(item) ||
      !object(item.content)
    )
      return null
    if (
      !exact(item.content, ['preview', 'byteLength']) ||
      typeof item.content.preview !== 'string' ||
      Array.from(item.content.preview).length > 160 ||
      !Number.isInteger(item.content.byteLength) ||
      Number(item.content.byteLength) < 1
    )
      return null
    return item
  })
  if (items.some((item) => item === null)) return null
  return value as JournalPage
}

export function parseTombstone(value: unknown): JournalTombstone | null {
  if (
    !object(value) ||
    !exact(value, ['id', 'ownerAccountId', 'deleted', 'deletedAt']) ||
    !isJournalId(value.id) ||
    !isJournalId(value.ownerAccountId) ||
    value.deleted !== true ||
    !dateTime(value.deletedAt)
  )
    return null
  return value as JournalTombstone
}

export function parseJournalWrite(value: unknown): JournalWrite | null {
  if (
    !object(value) ||
    !exact(value, ['content', 'mood', 'tags']) ||
    !object(value.content) ||
    !exact(value.content, ['text']) ||
    typeof value.content.text !== 'string' ||
    value.content.text.trim().length < 1 ||
    value.content.text.length > 12_000 ||
    (value.mood !== undefined && !isJournalMood(value.mood)) ||
    (value.tags !== undefined && !tags(value.tags))
  )
    return null
  return value as JournalWrite
}

export function parseJournalCreate(value: unknown): JournalCreate | null {
  if (
    !object(value) ||
    !exact(value, ['clientEntryId', 'occurredAt', 'content', 'mood', 'tags']) ||
    !isJournalId(value.clientEntryId) ||
    !dateTime(value.occurredAt)
  )
    return null
  const write = parseJournalWrite({
    content: value.content,
    ...(value.mood === undefined ? {} : { mood: value.mood }),
    ...(value.tags === undefined ? {} : { tags: value.tags }),
  })
  return write ? (value as JournalCreate) : null
}
