import type {
  CompanionContextKind,
  CompanionConversation,
  CompanionConversationSummary,
  CompanionQuota,
  CompanionSend,
  CompanionSendInput,
} from './companion-contract'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const rfc3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const dateTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  rfc3339.test(value) &&
  !Number.isNaN(Date.parse(value))
const contextKinds = new Set<CompanionContextKind>([
  'JOURNAL',
  'SUPPORT_PLAN',
  'REASSESSMENT',
])

const parseQuota = (value: unknown): CompanionQuota | null => {
  if (
    !object(value) ||
    !exact(value, [
      'plan',
      'policyVersion',
      'remaining',
      'resetAt',
      'limitDisplayed',
    ]) ||
    !['FREE', 'PLUS', 'PREMIUM'].includes(String(value.plan)) ||
    value.policyVersion !== 'companion-quota-v1' ||
    !dateTime(value.resetAt) ||
    typeof value.limitDisplayed !== 'boolean' ||
    (value.remaining !== null &&
      (!Number.isInteger(value.remaining) || Number(value.remaining) < 0)) ||
    (value.plan === 'PREMIUM' &&
      (value.remaining !== null || value.limitDisplayed !== false)) ||
    (value.plan !== 'PREMIUM' &&
      (value.remaining === null || value.limitDisplayed !== true))
  )
    return null
  return value as CompanionQuota
}

export const parseConversation = (
  value: unknown,
): CompanionConversation | null => {
  if (
    !object(value) ||
    !exact(value, [
      'conversationId',
      'title',
      'messages',
      'createdAt',
      'updatedAt',
      'expiresAt',
    ]) ||
    typeof value.conversationId !== 'string' ||
    !uuid.test(value.conversationId) ||
    typeof value.title !== 'string' ||
    value.title.length < 1 ||
    value.title.length > 80 ||
    !Array.isArray(value.messages) ||
    value.messages.length > 400 ||
    !dateTime(value.createdAt) ||
    !dateTime(value.updatedAt) ||
    !dateTime(value.expiresAt)
  )
    return null
  for (const message of value.messages) {
    if (
      !object(message) ||
      !exact(message, [
        'messageId',
        'role',
        'content',
        'createdAt',
        'contextKinds',
      ]) ||
      typeof message.messageId !== 'string' ||
      !uuid.test(message.messageId) ||
      !['USER', 'ASSISTANT'].includes(String(message.role)) ||
      typeof message.content !== 'string' ||
      message.content.length < 1 ||
      message.content.length > 2_000 ||
      !dateTime(message.createdAt) ||
      !Array.isArray(message.contextKinds) ||
      message.contextKinds.length > 3 ||
      !message.contextKinds.every(
        (kind) =>
          typeof kind === 'string' &&
          contextKinds.has(kind as CompanionContextKind),
      )
    )
      return null
  }
  return value as CompanionConversation
}

export const parseConversationList = (
  value: unknown,
): Readonly<{ items: CompanionConversationSummary[] }> | null => {
  if (
    !object(value) ||
    !exact(value, ['items']) ||
    !Array.isArray(value.items) ||
    value.items.length > 50
  )
    return null
  const items = value.items.map((item): CompanionConversationSummary | null => {
    if (
      !object(item) ||
      !exact(item, [
        'conversationId',
        'title',
        'createdAt',
        'updatedAt',
        'expiresAt',
      ]) ||
      typeof item.conversationId !== 'string' ||
      !uuid.test(item.conversationId) ||
      typeof item.title !== 'string' ||
      item.title.length < 1 ||
      item.title.length > 80 ||
      !dateTime(item.createdAt) ||
      !dateTime(item.updatedAt) ||
      !dateTime(item.expiresAt)
    )
      return null
    return item as CompanionConversationSummary
  })
  if (items.some((item) => item === null)) return null
  return { items: items as CompanionConversationSummary[] }
}

export const parseSend = (value: unknown): CompanionSend | null => {
  if (
    !object(value) ||
    !exact(value, [
      'conversationId',
      'userMessageId',
      'assistantMessageId',
      'assistant',
      'createdAt',
      'quota',
    ]) ||
    typeof value.conversationId !== 'string' ||
    !uuid.test(value.conversationId) ||
    typeof value.userMessageId !== 'string' ||
    !uuid.test(value.userMessageId) ||
    typeof value.assistantMessageId !== 'string' ||
    !uuid.test(value.assistantMessageId) ||
    typeof value.assistant !== 'string' ||
    value.assistant.length < 1 ||
    value.assistant.length > 500 ||
    !dateTime(value.createdAt) ||
    !parseQuota(value.quota)
  )
    return null
  return value as CompanionSend
}

export const parseSendInput = (value: unknown): CompanionSendInput | null => {
  if (
    !object(value) ||
    !exact(value, ['message', 'context']) ||
    typeof value.message !== 'string' ||
    value.message.trim().length < 1 ||
    value.message.length > 2_000
  )
    return null
  if (value.context === undefined) return { message: value.message.trim() }
  if (
    !object(value.context) ||
    !exact(value.context, [
      'journalIds',
      'longitudinalAnalysisId',
      'includeCurrentSupportPlan',
      'includeReminderContext',
    ])
  )
    return null
  const journalIds = value.context.journalIds
  if (
    journalIds !== undefined &&
    (!Array.isArray(journalIds) ||
      journalIds.length > 3 ||
      new Set(journalIds).size !== journalIds.length ||
      !journalIds.every((id) => typeof id === 'string' && uuid.test(id)))
  )
    return null
  if (
    value.context.longitudinalAnalysisId !== undefined &&
    (typeof value.context.longitudinalAnalysisId !== 'string' ||
      !uuid.test(value.context.longitudinalAnalysisId))
  )
    return null
  if (
    value.context.includeCurrentSupportPlan !== undefined &&
    typeof value.context.includeCurrentSupportPlan !== 'boolean'
  )
    return null
  if (
    value.context.includeReminderContext !== undefined &&
    typeof value.context.includeReminderContext !== 'boolean'
  )
    return null
  return {
    message: value.message.trim(),
    context: value.context as CompanionSendInput['context'],
  }
}

export const isConversationId = (value: unknown): value is string =>
  typeof value === 'string' && uuid.test(value)

export const isIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 16 && value.length <= 128
