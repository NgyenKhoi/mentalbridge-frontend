import type { components } from '@/contracts/consultation.generated'

export type SessionSummary = components['schemas']['SessionSummary']
export type SessionSummaryList = components['schemas']['SessionSummaryList']
export type PublishSessionSummaryInput =
  components['schemas']['PublishSessionSummaryRequest']
export type SessionSummaryReuseConsentInput =
  components['schemas']['SessionSummaryReuseConsentRequest']
export type UpdateAgreedNextStepInput =
  components['schemas']['UpdateAgreedNextStepRequest']
export type AgreedNextStepType = components['schemas']['AgreedNextStepType']
export type AgreedNextStepState = components['schemas']['AgreedNextStepState']

const STEP_TYPES: AgreedNextStepType[] = [
  'CHECKLIST',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'REASSESSMENT',
  'FOLLOW_UP_APPOINTMENT',
  'PLATFORM_RESOURCE',
]
const STEP_STATES: AgreedNextStepState[] = ['PENDING', 'COMPLETED', 'SKIPPED']

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function optionalText(value: unknown, max: number) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length <= max)
  )
}

function parseConsent(value: unknown) {
  if (value === null) return null
  const item = object(value)
  if (
    !item ||
    typeof item.approved !== 'boolean' ||
    !Number.isInteger(item.version) ||
    Number(item.version) < 0 ||
    !instant(item.updatedAt)
  )
    return null
  return item as SessionSummary['reuseConsent']
}

function parseStep(value: unknown) {
  const item = object(value)
  if (
    !item ||
    !uuid(item.id) ||
    !STEP_TYPES.includes(item.type as AgreedNextStepType) ||
    typeof item.title !== 'string' ||
    item.title.length < 1 ||
    item.title.length > 160 ||
    !optionalText(item.details, 1_000) ||
    !(item.resourceId === null || uuid(item.resourceId)) ||
    !(
      item.resourceVersion === null || typeof item.resourceVersion === 'string'
    ) ||
    !(
      item.state === null ||
      STEP_STATES.includes(item.state as AgreedNextStepState)
    ) ||
    typeof item.hidden !== 'boolean' ||
    !(item.stateVersion === null || Number.isInteger(item.stateVersion)) ||
    !(item.stateUpdatedAt === null || instant(item.stateUpdatedAt))
  )
    return null
  return item as SessionSummary['agreedNextSteps'][number]
}

export function parseSessionSummary(value: unknown): SessionSummary | null {
  const item = object(value)
  if (
    !item ||
    !Array.isArray(item.topicsDiscussed) ||
    !Array.isArray(item.agreedNextSteps)
  )
    return null
  const consent = parseConsent(item.reuseConsent)
  const steps = item.agreedNextSteps.map(parseStep)
  if (
    !uuid(item.id) ||
    !uuid(item.appointmentId) ||
    !uuid(item.userAccountId) ||
    !uuid(item.specialistAccountId) ||
    !Number.isInteger(item.version) ||
    Number(item.version) < 1 ||
    item.schemaVersion !== 'session-summary-v1' ||
    item.topicsDiscussed.length > 8 ||
    item.topicsDiscussed.some(
      (topic) =>
        typeof topic !== 'string' || topic.length < 1 || topic.length > 160,
    ) ||
    !optionalText(item.progressSummary, 1_000) ||
    !optionalText(item.specialistNoteForUser, 1_000) ||
    typeof item.followUpSuggested !== 'boolean' ||
    !(item.amendsSummaryId === null || uuid(item.amendsSummaryId)) ||
    !instant(item.publishedAt) ||
    (item.reuseConsent !== null && consent === null) ||
    steps.some((step) => step === null) ||
    steps.length > 8
  )
    return null
  return {
    ...(item as unknown as SessionSummary),
    reuseConsent: consent,
    agreedNextSteps: steps as SessionSummary['agreedNextSteps'],
  }
}

export function parseSessionSummaryList(
  value: unknown,
): SessionSummaryList | null {
  const list = object(value)
  if (
    !list ||
    !Array.isArray(list.items) ||
    !Number.isInteger(list.count) ||
    !instant(list.generatedAt)
  )
    return null
  const items = list.items.map(parseSessionSummary)
  if (items.some((item) => item === null) || list.count !== items.length)
    return null
  return {
    items: items as SessionSummary[],
    count: Number(list.count),
    generatedAt: list.generatedAt,
  }
}

export class SessionSummaryInputError extends Error {
  constructor(readonly field: string) {
    super(field)
  }
}

export function parsePublishSessionSummaryInput(
  value: unknown,
): PublishSessionSummaryInput {
  const input = object(value)
  if (
    !input ||
    !Array.isArray(input.topicsDiscussed) ||
    !Array.isArray(input.agreedNextSteps)
  )
    throw new SessionSummaryInputError('body')
  const topics = input.topicsDiscussed.map((topic) =>
    typeof topic === 'string' ? topic.trim() : topic,
  )
  const steps = input.agreedNextSteps.map((value, index) => {
    const step = object(value)
    if (!step) throw new SessionSummaryInputError(`agreedNextSteps.${index}`)
    const platformResource = step.type === 'PLATFORM_RESOURCE'
    if (
      !STEP_TYPES.includes(step.type as AgreedNextStepType) ||
      typeof step.title !== 'string' ||
      step.title.trim().length < 1 ||
      step.title.trim().length > 160 ||
      !optionalText(step.details, 500) ||
      (platformResource &&
        (!uuid(step.resourceId) ||
          typeof step.resourceVersion !== 'string' ||
          !step.resourceVersion)) ||
      (!platformResource &&
        (step.resourceId != null || step.resourceVersion != null))
    )
      throw new SessionSummaryInputError(`agreedNextSteps.${index}`)
    return {
      type: step.type as AgreedNextStepType,
      title: step.title.trim(),
      details:
        typeof step.details === 'string' ? step.details.trim() || null : null,
      resourceId: platformResource ? (step.resourceId as string) : null,
      resourceVersion: platformResource
        ? (step.resourceVersion as string)
        : null,
    }
  })
  if (
    topics.length < 1 ||
    topics.length > 8 ||
    topics.some(
      (topic) =>
        typeof topic !== 'string' || topic.length < 1 || topic.length > 160,
    ) ||
    !optionalText(input.progressSummary, 1_000) ||
    !optionalText(input.specialistNoteForUser, 1_000) ||
    typeof input.followUpSuggested !== 'boolean' ||
    steps.length > 8
  )
    throw new SessionSummaryInputError('body')
  return {
    topicsDiscussed: topics as string[],
    progressSummary:
      typeof input.progressSummary === 'string'
        ? input.progressSummary.trim() || null
        : null,
    specialistNoteForUser:
      typeof input.specialistNoteForUser === 'string'
        ? input.specialistNoteForUser.trim() || null
        : null,
    followUpSuggested: input.followUpSuggested,
    agreedNextSteps: steps,
  }
}

export function parseSessionSummaryReuseConsentInput(
  value: unknown,
): SessionSummaryReuseConsentInput {
  const input = object(value)
  if (
    !input ||
    typeof input.approved !== 'boolean' ||
    Object.keys(input).length !== 1
  )
    throw new SessionSummaryInputError('approved')
  return { approved: input.approved }
}

export function parseUpdateAgreedNextStepInput(
  value: unknown,
): UpdateAgreedNextStepInput {
  const input = object(value)
  if (
    !input ||
    !STEP_STATES.includes(input.state as AgreedNextStepState) ||
    typeof input.hidden !== 'boolean' ||
    Object.keys(input).some((key) => !['state', 'hidden'].includes(key))
  )
    throw new SessionSummaryInputError('body')
  return { state: input.state as AgreedNextStepState, hidden: input.hidden }
}
