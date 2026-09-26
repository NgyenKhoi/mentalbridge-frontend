import type { components } from '@/contracts/content.generated'

export type ResourceSummary = components['schemas']['ResourceSummary']
export type PublicResourceDetail = components['schemas']['PublicResourceDetail']
export type AdminResourceDetail = components['schemas']['AdminResourceDetail']
export type ResourceListResponse = components['schemas']['ResourceListResponse']
export type NotificationPreferences =
  components['schemas']['NotificationPreferences']
export type NotificationPreferencePatch =
  components['schemas']['NotificationPreferencePatch']
export type Notification = components['schemas']['Notification']
export type NotificationPage = components['schemas']['NotificationPage']
export type NotificationBulkReadResult =
  components['schemas']['NotificationBulkReadResult']

const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const CONTENT_VERSION = /^(0|[1-9]\d{0,18})$/
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

function optionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string'
}

export function isResourceId(value: string): boolean {
  return UUID.test(value)
}

export function isLocale(value: string): boolean {
  return LOCALE.test(value)
}

export function isContentVersion(value: string): boolean {
  return CONTENT_VERSION.test(value)
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
    !optionalNullableString(item.sourceOrganization) ||
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

export function parsePublicResourceDetail(
  value: unknown,
): PublicResourceDetail | null {
  const summary = parseResourceSummary(value)
  const item = record(value)
  if (
    !summary ||
    !item ||
    typeof item.contentVersion !== 'string' ||
    !CONTENT_VERSION.test(item.contentVersion) ||
    !(item.contentBody === null || typeof item.contentBody === 'string') ||
    !optionalNullableString(item.sourceTitle) ||
    !optionalNullableHttpUrl(item.sourceUrl) ||
    !optionalNullableString(item.sourceReviewNote) ||
    !nullableDateTime(item.effectiveAt) ||
    !nullableDateTime(item.expiresAt)
  ) {
    return null
  }
  return item as PublicResourceDetail
}

export function parseAdminResourceDetail(
  value: unknown,
): AdminResourceDetail | null {
  const summary = parsePublicResourceDetail(value)
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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const EMAIL_CADENCES = new Set(['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST'])

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((key) => allowed.includes(key))
}

function booleanObject(
  value: unknown,
  allowed: readonly string[],
  requireAll: boolean,
): value is Record<string, boolean> {
  const item = record(value)
  if (!item || !exactKeys(item, allowed)) return false
  return (
    (!requireAll || allowed.every((key) => key in item)) &&
    Object.values(item).every((entry) => typeof entry === 'boolean')
  )
}

export function parseNotificationPreferences(
  value: unknown,
): NotificationPreferences | null {
  const item = record(value)
  const quietHours = record(item?.quietHours)
  const email = record(item?.email)
  if (
    !item ||
    !exactKeys(item, [
      'notificationsEnabled',
      'channels',
      'contentGroups',
      'quietHours',
      'email',
      'version',
      'updatedAt',
    ]) ||
    typeof item.notificationsEnabled !== 'boolean' ||
    !booleanObject(item.channels, ['inApp', 'email', 'push'], true) ||
    !booleanObject(
      item.contentGroups,
      [
        'journalReminder',
        'emotionCheckIn',
        'streakMilestone',
        'screeningReassessment',
        'appointmentMessage',
        'resourceSystem',
      ],
      true,
    ) ||
    !quietHours ||
    !exactKeys(quietHours, ['enabled', 'start', 'end', 'timeZone']) ||
    typeof quietHours.enabled !== 'boolean' ||
    typeof quietHours.start !== 'string' ||
    !TIME.test(quietHours.start) ||
    typeof quietHours.end !== 'string' ||
    !TIME.test(quietHours.end) ||
    typeof quietHours.timeZone !== 'string' ||
    quietHours.timeZone.length < 1 ||
    quietHours.timeZone.length > 64 ||
    !email ||
    !exactKeys(email, [
      'cadence',
      'wellbeingDigestEnabled',
      'resourceRemindersEnabled',
    ]) ||
    typeof email.cadence !== 'string' ||
    !EMAIL_CADENCES.has(email.cadence) ||
    typeof email.wellbeingDigestEnabled !== 'boolean' ||
    typeof email.resourceRemindersEnabled !== 'boolean' ||
    !Number.isSafeInteger(item.version) ||
    (item.version as number) < 0 ||
    !dateTime(item.updatedAt)
  ) {
    return null
  }
  return item as NotificationPreferences
}

export function parseNotificationPreferencePatch(
  value: unknown,
): NotificationPreferencePatch | null {
  const item = record(value)
  if (
    !item ||
    !exactKeys(item, [
      'notificationsEnabled',
      'channels',
      'contentGroups',
      'quietHours',
      'email',
    ]) ||
    (item.notificationsEnabled !== undefined &&
      typeof item.notificationsEnabled !== 'boolean') ||
    (item.channels !== undefined &&
      !booleanObject(item.channels, ['inApp', 'email', 'push'], false)) ||
    (item.contentGroups !== undefined &&
      !booleanObject(
        item.contentGroups,
        [
          'journalReminder',
          'emotionCheckIn',
          'streakMilestone',
          'screeningReassessment',
          'appointmentMessage',
          'resourceSystem',
        ],
        false,
      ))
  ) {
    return null
  }

  if (item.quietHours !== undefined) {
    const quietHours = record(item.quietHours)
    if (
      !quietHours ||
      !exactKeys(quietHours, ['enabled', 'start', 'end', 'timeZone']) ||
      (quietHours.enabled !== undefined &&
        typeof quietHours.enabled !== 'boolean') ||
      (quietHours.start !== undefined &&
        (typeof quietHours.start !== 'string' ||
          !TIME.test(quietHours.start))) ||
      (quietHours.end !== undefined &&
        (typeof quietHours.end !== 'string' || !TIME.test(quietHours.end))) ||
      (quietHours.timeZone !== undefined &&
        (typeof quietHours.timeZone !== 'string' ||
          quietHours.timeZone.length < 1 ||
          quietHours.timeZone.length > 64))
    ) {
      return null
    }
  }

  if (item.email !== undefined) {
    const email = record(item.email)
    if (
      !email ||
      !exactKeys(email, [
        'cadence',
        'wellbeingDigestEnabled',
        'resourceRemindersEnabled',
      ]) ||
      (email.cadence !== undefined &&
        (typeof email.cadence !== 'string' ||
          !EMAIL_CADENCES.has(email.cadence))) ||
      (email.wellbeingDigestEnabled !== undefined &&
        typeof email.wellbeingDigestEnabled !== 'boolean') ||
      (email.resourceRemindersEnabled !== undefined &&
        typeof email.resourceRemindersEnabled !== 'boolean')
    ) {
      return null
    }
  }
  return item as NotificationPreferencePatch
}

const NOTIFICATION_KINDS = new Set([
  'REMINDER',
  'MESSAGE',
  'APPOINTMENT',
  'SYSTEM_RESOURCE',
  'ASSESSMENT_REASSESSMENT',
  'STREAK_MILESTONE',
])
const NOTIFICATION_PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH'])
const TARGETLESS_NOTIFICATION_ACTIONS: Readonly<Record<string, string>> = {
  OPEN_JOURNAL: '/journal',
  OPEN_MESSAGES: '/messages',
  OPEN_APPOINTMENTS: '/appointments',
  OPEN_RESOURCES: '/resources',
  OPEN_ASSESSMENTS: '/assessments',
}

export function parseNotification(value: unknown): Notification | null {
  const item = record(value)
  const action = item?.action === null ? null : record(item?.action)
  if (
    !item ||
    !exactKeys(item, [
      'id',
      'kind',
      'title',
      'body',
      'priority',
      'occurredAt',
      'createdAt',
      'read',
      'readAt',
      'action',
      'lifecycleState',
      'expiresAt',
    ]) ||
    typeof item.id !== 'string' ||
    !UUID.test(item.id) ||
    typeof item.kind !== 'string' ||
    !NOTIFICATION_KINDS.has(item.kind) ||
    typeof item.title !== 'string' ||
    item.title.length < 1 ||
    item.title.length > 255 ||
    typeof item.body !== 'string' ||
    item.body.length < 1 ||
    item.body.length > 1000 ||
    typeof item.priority !== 'string' ||
    !NOTIFICATION_PRIORITIES.has(item.priority) ||
    !dateTime(item.occurredAt) ||
    !dateTime(item.createdAt) ||
    typeof item.read !== 'boolean' ||
    !nullableDateTime(item.readAt) ||
    item.lifecycleState !== 'ACTIVE' ||
    !dateTime(item.expiresAt)
  ) {
    return null
  }
  if (item.read !== (item.readAt !== null)) return null
  if (action !== null) {
    if (
      !exactKeys(action, ['type', 'targetId', 'href']) ||
      typeof action.type !== 'string' ||
      typeof action.href !== 'string' ||
      !action.href.startsWith('/') ||
      action.href.startsWith('//') ||
      action.href.length > 256
    ) {
      return null
    }
    if (action.type === 'OPEN_RESOURCE') {
      if (typeof action.targetId !== 'string' || !UUID.test(action.targetId))
        return null
      if (action.href !== `/resources/${action.targetId}`) return null
    } else if (
      TARGETLESS_NOTIFICATION_ACTIONS[action.type] !== action.href ||
      action.targetId !== null
    ) {
      return null
    }
  }
  return item as Notification
}

export function parseNotificationPage(value: unknown): NotificationPage | null {
  const page = record(value)
  if (
    !page ||
    !exactKeys(page, ['items', 'nextCursor', 'hasMore', 'unreadCount']) ||
    !Array.isArray(page.items) ||
    page.items.length > 50 ||
    !page.items.every((item) => parseNotification(item) !== null) ||
    !(page.nextCursor === null || typeof page.nextCursor === 'string') ||
    (typeof page.nextCursor === 'string' &&
      (page.nextCursor.length < 1 || page.nextCursor.length > 256)) ||
    typeof page.hasMore !== 'boolean' ||
    !Number.isSafeInteger(page.unreadCount) ||
    (page.unreadCount as number) < 0 ||
    page.hasMore !== (page.nextCursor !== null)
  ) {
    return null
  }
  return page as NotificationPage
}

export function parseNotificationBulkReadResult(
  value: unknown,
): NotificationBulkReadResult | null {
  const result = record(value)
  if (
    !result ||
    !exactKeys(result, ['updatedCount']) ||
    !Number.isSafeInteger(result.updatedCount) ||
    (result.updatedCount as number) < 0
  ) {
    return null
  }
  return result as NotificationBulkReadResult
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
