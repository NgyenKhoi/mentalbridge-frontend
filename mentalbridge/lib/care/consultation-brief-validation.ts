import type {
  ConsultationBrief,
  ConsultationBriefDraftRequest,
  ConsultationBriefScreeningContext,
  SpecialistConsultationBrief,
  SpecialistClientContinuityList,
  ConsultationBriefScreeningContextList,
} from '@/features/appointments/api/consultation-brief-contract'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function boundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.length <= maximum
  )
}

function screening(value: unknown): value is ConsultationBriefScreeningContext {
  if (!record(value)) return false
  return (
    exact(value, [
      'instrument',
      'domain',
      'screeningLevel',
      'questionnaireVersion',
      'scoringVersion',
      'evaluatedAt',
      'policyVersion',
    ]) &&
    ['PHQ9', 'GAD7'].includes(String(value.instrument)) &&
    ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'].includes(
      String(value.domain),
    ) &&
    ['MINIMAL', 'MILD', 'MODERATE', 'MODERATELY_SEVERE', 'SEVERE'].includes(
      String(value.screeningLevel),
    ) &&
    boundedText(value.questionnaireVersion, 32) &&
    boundedText(value.scoringVersion, 32) &&
    instant(value.evaluatedAt) &&
    boundedText(value.policyVersion, 64)
  )
}

function goals(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 5 &&
    value.every((goal) => boundedText(goal, 200))
  )
}

function contexts(
  value: unknown,
): value is ConsultationBriefScreeningContext[] {
  return Array.isArray(value) && value.length === 2 && value.every(screening)
}

export function parseConsultationBriefDraftRequest(
  value: unknown,
): ConsultationBriefDraftRequest | null {
  if (!record(value)) return null
  if (!exact(value, ['currentSituation', 'supportEvaluationId', 'userGoals']))
    return null
  if (
    !boundedText(value.currentSituation, 1000) ||
    typeof value.supportEvaluationId !== 'string' ||
    !UUID.test(value.supportEvaluationId) ||
    !goals(value.userGoals)
  )
    return null
  return value as ConsultationBriefDraftRequest
}

export function parseConsultationBrief(
  value: unknown,
): ConsultationBrief | null {
  if (!record(value)) return null
  if (
    !exact(value, [
      'id',
      'appointmentId',
      'status',
      'currentSituation',
      'supportEvaluationId',
      'screeningContext',
      'userGoals',
      'approvedSnapshotId',
      'sharingStatus',
      'accessStartAt',
      'accessEndAt',
      'version',
      'updatedAt',
    ]) ||
    typeof value.id !== 'string' ||
    !UUID.test(value.id) ||
    typeof value.appointmentId !== 'string' ||
    !UUID.test(value.appointmentId) ||
    !['DRAFT', 'APPROVED'].includes(String(value.status)) ||
    !boundedText(value.currentSituation, 1000) ||
    typeof value.supportEvaluationId !== 'string' ||
    !UUID.test(value.supportEvaluationId) ||
    !contexts(value.screeningContext) ||
    !goals(value.userGoals) ||
    !(
      value.approvedSnapshotId === null ||
      (typeof value.approvedSnapshotId === 'string' &&
        UUID.test(value.approvedSnapshotId))
    ) ||
    !['NONE', 'ACTIVE', 'REVOKED'].includes(String(value.sharingStatus)) ||
    !(value.accessStartAt === null || instant(value.accessStartAt)) ||
    !(value.accessEndAt === null || instant(value.accessEndAt)) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 0 ||
    !instant(value.updatedAt) ||
    (value.sharingStatus === 'NONE' &&
      (value.approvedSnapshotId !== null ||
        value.accessStartAt !== null ||
        value.accessEndAt !== null)) ||
    (value.sharingStatus !== 'NONE' &&
      (value.approvedSnapshotId === null ||
        value.accessStartAt === null ||
        value.accessEndAt === null)) ||
    (value.sharingStatus === 'ACTIVE' && value.status !== 'APPROVED')
  )
    return null
  return value as ConsultationBrief
}

export function parseSpecialistConsultationBrief(
  value: unknown,
): SpecialistConsultationBrief | null {
  if (!record(value)) return null
  if (
    !exact(value, [
      'snapshotId',
      'appointmentId',
      'currentSituation',
      'supportEvaluationId',
      'screeningContext',
      'userGoals',
      'snapshotVersion',
      'approvedAt',
      'accessStartAt',
      'accessEndAt',
      'sourceType',
    ]) ||
    typeof value.snapshotId !== 'string' ||
    !UUID.test(value.snapshotId) ||
    typeof value.appointmentId !== 'string' ||
    !UUID.test(value.appointmentId) ||
    !boundedText(value.currentSituation, 1000) ||
    typeof value.supportEvaluationId !== 'string' ||
    !UUID.test(value.supportEvaluationId) ||
    !contexts(value.screeningContext) ||
    !goals(value.userGoals) ||
    !Number.isSafeInteger(value.snapshotVersion) ||
    Number(value.snapshotVersion) < 1 ||
    !instant(value.approvedAt) ||
    !instant(value.accessStartAt) ||
    !instant(value.accessEndAt) ||
    value.sourceType !== 'CONSULTATION_BRIEF'
  )
    return null
  return value as SpecialistConsultationBrief
}

export function parseSpecialistClientContinuityList(
  value: unknown,
): SpecialistClientContinuityList | null {
  if (
    !record(value) ||
    !exact(value, [
      'items',
      'count',
      'generatedAt',
      'recentSince',
      'policyVersion',
    ]) ||
    !Array.isArray(value.items) ||
    value.items.length > 200 ||
    !Number.isSafeInteger(value.count) ||
    value.count !== value.items.length ||
    !instant(value.generatedAt) ||
    !instant(value.recentSince) ||
    value.policyVersion !== 'specialist-client-continuity-v1'
  )
    return null
  const valid = value.items.every(
    (item) =>
      record(item) &&
      exact(item, [
        'appointmentId',
        'userAccountId',
        'userDisplayName',
        'status',
        'modality',
        'scheduledStartAt',
        'scheduledEndAt',
        'appointmentVersion',
        'briefAccessState',
        'briefSnapshotVersion',
        'briefAccessStartAt',
        'briefAccessEndAt',
      ]) &&
      typeof item.appointmentId === 'string' &&
      UUID.test(item.appointmentId) &&
      typeof item.userAccountId === 'string' &&
      UUID.test(item.userAccountId) &&
      boundedText(item.userDisplayName, 120) &&
      ['CONFIRMED', 'IN_PROGRESS', 'SESSION_ENDED', 'COMPLETED'].includes(
        String(item.status),
      ) &&
      ['IN_APP_CHAT', 'IN_APP_VIDEO'].includes(String(item.modality)) &&
      instant(item.scheduledStartAt) &&
      instant(item.scheduledEndAt) &&
      Number.isSafeInteger(item.appointmentVersion) &&
      Number(item.appointmentVersion) >= 0 &&
      [
        'NOT_SHARED',
        'REVOKED',
        'STALE',
        'TOO_EARLY',
        'AVAILABLE',
        'EXPIRED',
        'UNAVAILABLE',
      ].includes(String(item.briefAccessState)) &&
      (item.briefSnapshotVersion === null ||
        (Number.isSafeInteger(item.briefSnapshotVersion) &&
          Number(item.briefSnapshotVersion) >= 1)) &&
      (item.briefAccessStartAt === null || instant(item.briefAccessStartAt)) &&
      (item.briefAccessEndAt === null || instant(item.briefAccessEndAt)),
  )
  return valid ? (value as SpecialistClientContinuityList) : null
}

export function parseConsultationBriefScreeningContexts(
  value: unknown,
): ConsultationBriefScreeningContextList | null {
  if (!record(value) || !exact(value, ['items', 'count'])) return null
  if (
    !Array.isArray(value.items) ||
    value.items.length > 20 ||
    !Number.isSafeInteger(value.count) ||
    value.count !== value.items.length
  )
    return null
  const valid = value.items.every(
    (item) =>
      record(item) &&
      exact(item, ['supportEvaluationId', 'evaluatedAt', 'screeningContext']) &&
      typeof item.supportEvaluationId === 'string' &&
      UUID.test(item.supportEvaluationId) &&
      instant(item.evaluatedAt) &&
      contexts(item.screeningContext),
  )
  return valid ? (value as ConsultationBriefScreeningContextList) : null
}
