import type { components } from '@/contracts/care.generated'

import { isUuid } from './care-validation'

export type CombinedScreeningMeaning =
  components['schemas']['CombinedScreeningMeaning']
export type ScreeningEpisodeHistoryPage =
  components['schemas']['ScreeningEpisodeHistoryPage']

const PHQ9_LEVELS = new Set([
  'MINIMAL',
  'MILD',
  'MODERATE',
  'MODERATELY_SEVERE',
  'SEVERE',
])
const GAD7_LEVELS = new Set(['MINIMAL', 'MILD', 'MODERATE', 'SEVERE'])
const BASE_TIERS = new Set([
  'SELF_GUIDED_SUPPORT',
  'PROFESSIONAL_SUPPORT_RECOMMENDED',
])
const DISCLAIMER =
  'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  )
}

function text(value: unknown, maximum = 1000): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return (
        code === 0xfffd ||
        (code >= 0x7f && code <= 0x9f) ||
        (code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code))
      )
    })
  )
}

function evidence(value: unknown, instrument: 'PHQ9' | 'GAD7') {
  const maximum = instrument === 'PHQ9' ? 27 : 21
  return (
    record(value) &&
    exact(value, [
      'assessmentId',
      'instrument',
      'questionnaireVersion',
      'scoringVersion',
      'totalScore',
      'screeningLevel',
      'safetyStatus',
    ]) &&
    isUuid(value.assessmentId) &&
    value.instrument === instrument &&
    text(value.questionnaireVersion, 32) &&
    text(value.scoringVersion, 32) &&
    Number.isInteger(value.totalScore) &&
    Number(value.totalScore) >= 0 &&
    Number(value.totalScore) <= maximum &&
    (instrument === 'PHQ9' ? PHQ9_LEVELS : GAD7_LEVELS).has(
      String(value.screeningLevel),
    ) &&
    (instrument === 'PHQ9'
      ? ['NEGATIVE_SAFETY_SCREEN', 'POSITIVE_SAFETY_SCREEN'].includes(
          String(value.safetyStatus),
        )
      : value.safetyStatus === 'NOT_APPLICABLE')
  )
}

function dateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    !Number.isNaN(Date.parse(value))
  )
}

function historyEvidence(value: unknown, instrument: 'PHQ9' | 'GAD7') {
  const maximum = instrument === 'PHQ9' ? 27 : 21
  if (
    !record(value) ||
    !exact(value, [
      'instrument',
      'state',
      'assessmentId',
      'totalScore',
      'screeningLevel',
      'safetyStatus',
    ]) ||
    value.instrument !== instrument ||
    !['AVAILABLE', 'MISSING', 'UNAVAILABLE'].includes(String(value.state))
  )
    return false

  if (value.state === 'MISSING')
    return (
      value.assessmentId === null &&
      value.totalScore === null &&
      value.screeningLevel === null &&
      value.safetyStatus === null
    )

  if (!isUuid(value.assessmentId)) return false
  if (value.state === 'UNAVAILABLE')
    return (
      value.totalScore === null &&
      value.screeningLevel === null &&
      value.safetyStatus === null
    )

  return (
    Number.isInteger(value.totalScore) &&
    Number(value.totalScore) >= 0 &&
    Number(value.totalScore) <= maximum &&
    (instrument === 'PHQ9' ? PHQ9_LEVELS : GAD7_LEVELS).has(
      String(value.screeningLevel),
    ) &&
    (instrument === 'PHQ9'
      ? ['NEGATIVE_SAFETY_SCREEN', 'POSITIVE_SAFETY_SCREEN'].includes(
          String(value.safetyStatus),
        )
      : value.safetyStatus === 'NOT_APPLICABLE')
  )
}

export function parseCombinedScreeningMeaning(
  value: unknown,
  expectedSupportEvaluationId: string,
): CombinedScreeningMeaning | null {
  if (
    !record(value) ||
    !exact(value, [
      'supportEvaluationId',
      'sourcePolicyVersion',
      'evaluatedAt',
      'presentationPolicyVersion',
      'contentVersion',
      'referencePeriodDays',
      'episodeId',
      'episodePurpose',
      'episodeCompletedAt',
      'domainSupportEvaluationId',
      'supportGuideId',
      'evidence',
      'supportTier',
      'baseMeaning',
      'presentationPriority',
      'nextStep',
      'safetyGuidance',
      'disclaimerCode',
      'disclaimer',
    ]) ||
    !isUuid(value.supportEvaluationId) ||
    value.supportEvaluationId.toLowerCase() !==
      expectedSupportEvaluationId.toLowerCase() ||
    value.sourcePolicyVersion !== 'mb-support-routing-capstone-v1' ||
    !dateTime(value.evaluatedAt) ||
    value.presentationPolicyVersion !== 'mb-combined-screening-meaning-v1' ||
    value.contentVersion !== 'mb-combined-screening-meaning-vi-vn-v1-draft.3' ||
    value.referencePeriodDays !== 14 ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== 2 ||
    !evidence(value.evidence[0], 'PHQ9') ||
    !evidence(value.evidence[1], 'GAD7') ||
    !record(value.baseMeaning) ||
    !exact(value.baseMeaning, ['code', 'text', 'rationale', 'supportTier']) ||
    !text(value.baseMeaning.code, 64) ||
    !text(value.baseMeaning.text) ||
    !text(value.baseMeaning.rationale) ||
    !BASE_TIERS.has(String(value.baseMeaning.supportTier)) ||
    !record(value.nextStep) ||
    !exact(value.nextStep, ['code', 'contentVersion', 'text', 'boundary']) ||
    !text(value.nextStep.code, 64) ||
    !/^[A-Z0-9_]+$/.test(value.nextStep.code) ||
    !text(value.nextStep.contentVersion, 64) ||
    !text(value.nextStep.text) ||
    !text(value.nextStep.boundary) ||
    value.disclaimerCode !== 'SCREENING_NOT_DIAGNOSIS' ||
    value.disclaimer !== DISCLAIMER
  )
    return null

  const [phq9, gad7] = value.evidence
  const hasEpisodeContext = value.episodeId !== null
  if (
    !record(phq9) ||
    !record(gad7) ||
    String(phq9.assessmentId).toLowerCase() ===
      String(gad7.assessmentId).toLowerCase() ||
    value.baseMeaning.code !==
      `PHQ9_${String(phq9.screeningLevel)}_GAD7_${String(gad7.screeningLevel)}`
  )
    return null

  if (
    (hasEpisodeContext &&
      (!isUuid(value.episodeId) ||
        !['INITIAL_CHECK', 'REASSESSMENT'].includes(
          String(value.episodePurpose),
        ) ||
        !dateTime(value.episodeCompletedAt) ||
        !isUuid(value.domainSupportEvaluationId))) ||
    (!hasEpisodeContext &&
      (value.episodePurpose !== null ||
        value.episodeCompletedAt !== null ||
        value.domainSupportEvaluationId !== null ||
        value.supportGuideId !== null)) ||
    (value.supportGuideId !== null && !isUuid(value.supportGuideId))
  )
    return null
  if (phq9.safetyStatus === 'POSITIVE_SAFETY_SCREEN') {
    if (
      value.supportTier !== 'SAFETY_FOLLOW_UP_RECOMMENDED' ||
      value.presentationPriority !== 'SAFETY' ||
      !text(value.safetyGuidance)
    )
      return null
  } else if (
    value.supportTier !== value.baseMeaning.supportTier ||
    value.presentationPriority !==
      (value.supportTier === 'PROFESSIONAL_SUPPORT_RECOMMENDED'
        ? 'PROFESSIONAL_SUPPORT'
        : 'SELF_GUIDED') ||
    value.safetyGuidance !== null
  )
    return null

  return value as CombinedScreeningMeaning
}

export function parseScreeningEpisodeHistory(
  value: unknown,
): ScreeningEpisodeHistoryPage | null {
  if (
    !record(value) ||
    !exact(value, ['items', 'nextCursor', 'hasMore']) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    typeof value.hasMore !== 'boolean' ||
    (value.nextCursor !== null &&
      (typeof value.nextCursor !== 'string' ||
        value.nextCursor.length < 1 ||
        value.nextCursor.length > 256))
  )
    return null

  const items = value.items.map((item) => {
    if (
      !record(item) ||
      !exact(item, [
        'episodeId',
        'purpose',
        'status',
        'startedAt',
        'updatedAt',
        'completedAt',
        'presentationEvaluationId',
        'meaningState',
        'evidence',
        'meaning',
      ]) ||
      !isUuid(item.episodeId) ||
      !['INITIAL_CHECK', 'REASSESSMENT'].includes(String(item.purpose)) ||
      !['IN_PROGRESS', 'READY', 'COMPLETED'].includes(String(item.status)) ||
      !dateTime(item.startedAt) ||
      !dateTime(item.updatedAt) ||
      Date.parse(item.updatedAt) < Date.parse(item.startedAt) ||
      !['AVAILABLE', 'INCOMPLETE', 'UNAVAILABLE'].includes(
        String(item.meaningState),
      ) ||
      !Array.isArray(item.evidence) ||
      item.evidence.length !== 2 ||
      !historyEvidence(item.evidence[0], 'PHQ9') ||
      !historyEvidence(item.evidence[1], 'GAD7')
    )
      return null

    if (item.meaningState === 'INCOMPLETE') {
      const missingEvidence = item.evidence.filter(
        (entry) => record(entry) && entry.state === 'MISSING',
      ).length
      return item.status !== 'COMPLETED' &&
        item.completedAt === null &&
        item.presentationEvaluationId === null &&
        item.meaning === null &&
        ((item.status === 'IN_PROGRESS' && missingEvidence >= 1) ||
          (item.status === 'READY' && missingEvidence === 0))
        ? item
        : null
    }

    if (item.meaningState === 'UNAVAILABLE') {
      return item.status === 'COMPLETED' &&
        dateTime(item.completedAt) &&
        item.meaning === null &&
        (item.presentationEvaluationId === null ||
          isUuid(item.presentationEvaluationId))
        ? item
        : null
    }

    if (
      item.status !== 'COMPLETED' ||
      !dateTime(item.completedAt) ||
      !isUuid(item.presentationEvaluationId)
    )
      return null
    const meaning = parseCombinedScreeningMeaning(
      item.meaning,
      item.presentationEvaluationId,
    )
    const exactEvidenceMatches =
      meaning !== null &&
      item.evidence.every((entry, index) => {
        const source = meaning.evidence[index]
        return (
          entry.state === 'AVAILABLE' &&
          entry.assessmentId === source.assessmentId &&
          entry.instrument === source.instrument &&
          entry.totalScore === source.totalScore &&
          entry.screeningLevel === source.screeningLevel &&
          entry.safetyStatus === source.safetyStatus
        )
      })
    return meaning &&
      exactEvidenceMatches &&
      meaning.episodeId === item.episodeId &&
      meaning.episodePurpose === item.purpose &&
      meaning.episodeCompletedAt === item.completedAt
      ? { ...item, meaning }
      : null
  })

  if (items.some((item) => item === null)) return null
  if (
    (value.hasMore && value.nextCursor === null) ||
    (!value.hasMore && value.nextCursor !== null)
  )
    return null
  if (
    new Set(items.map((item) => String(item?.episodeId).toLowerCase())).size !==
    items.length
  )
    return null
  return {
    items: items as ScreeningEpisodeHistoryPage['items'],
    nextCursor: value.nextCursor,
    hasMore: value.hasMore,
  }
}
