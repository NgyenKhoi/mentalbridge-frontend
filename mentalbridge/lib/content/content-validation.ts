import type { components } from '@/contracts/content.generated'

export type ResourceSummary = components['schemas']['ResourceSummary']
export type PublicResourceDetail = components['schemas']['PublicResourceDetail']
export type AdminResourceDetail = components['schemas']['AdminResourceDetail']
export type ResourceReviewDecision =
  components['schemas']['ResourceReviewDecision']
export type ResourceListResponse = components['schemas']['ResourceListResponse']
export type NotificationPreferences =
  components['schemas']['NotificationPreferences']
export type NotificationPreferencePatch =
  components['schemas']['NotificationPreferencePatch']
export type WellbeingDigestPreview =
  components['schemas']['WellbeingDigestPreview']
export type Notification = components['schemas']['Notification']
export type NotificationPage = components['schemas']['NotificationPage']
export type NotificationBulkReadResult =
  components['schemas']['NotificationBulkReadResult']
export type ResourceProgressItem = components['schemas']['ResourceProgressItem']
export type ResourceProgressList = components['schemas']['ResourceProgressList']
export type ResourceProgressUpdate =
  components['schemas']['ResourceProgressUpdate']
export type ResourceJourney = components['schemas']['ResourceJourney']
export type ResourceJourneyRequest =
  components['schemas']['ResourceJourneyRequest']
export type ResourceBookmark = components['schemas']['ResourceBookmark']
export type ResourceBookmarkList = components['schemas']['ResourceBookmarkList']
export type ResourceBingoBoard = components['schemas']['ResourceBingoBoard']
export type ResourceBingoSelfConfirmationUpdate =
  components['schemas']['ResourceBingoSelfConfirmationUpdate']
export type AchievementCollection =
  components['schemas']['AchievementCollection']
export type AchievementPreferenceUpdate =
  components['schemas']['AchievementPreferenceUpdate']

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
const PROGRESS_STATUSES = new Set(['IN_PROGRESS', 'COMPLETED'])
const RESOURCE_KINDS = new Set([
  'LEARNING',
  'PRACTICE',
  'HABIT',
  'ACTION',
  'REFLECTION',
])
const INTERACTION_TYPES = new Set([
  'STRUCTURED_READER',
  'VIDEO_TRANSCRIPT',
  'BREATHING_PACER',
  'GROUNDING_GUIDE',
  'PROGRESSIVE_RELAXATION',
  'WALK_TIMER',
  'STRETCH_SEQUENCE',
  'PROBLEM_SOLVING_WORKSHEET',
  'BEHAVIORAL_ACTIVATION_PLANNER',
  'SELF_COMPASSION_PROMPTS',
  'UNHOOKING_PROMPTS',
  'PREPARE_FOR_SPECIALIST_CHECKLIST',
  'REFLECTION',
])
const COMPLETION_MODES = new Set([
  'EXPLICIT',
  'STEPS',
  'TIMED',
  'VIDEO_CONFIRMATION',
])
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/
const ACTION_ID = /^[A-Za-z0-9:_-]{1,64}$/

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

function validResourceExperience(item: Record<string, unknown>) {
  if (item.resourceKind === undefined) return true
  return (
    typeof item.resourceKind === 'string' &&
    RESOURCE_KINDS.has(item.resourceKind) &&
    typeof item.interactionType === 'string' &&
    INTERACTION_TYPES.has(item.interactionType) &&
    (item.repeatability === 'ONE_TIME' ||
      item.repeatability === 'REPEATABLE') &&
    typeof item.completionMode === 'string' &&
    COMPLETION_MODES.has(item.completionMode) &&
    typeof item.streakEligible === 'boolean' &&
    Number.isSafeInteger(item.expectedDurationMinutes) &&
    (item.expectedDurationMinutes as number) >= 1 &&
    Number.isSafeInteger(item.cooldownDays) &&
    (item.cooldownDays as number) >= 0 &&
    Number.isSafeInteger(item.recommendedFrequencyPerWeek) &&
    (item.recommendedFrequencyPerWeek as number) >= 1 &&
    Array.isArray(item.planTags) &&
    item.planTags.every((tag) => typeof tag === 'string')
  )
}

function validOptionalResourceDetailExperience(item: Record<string, unknown>) {
  if (item.structuredContent === undefined) return true
  return (
    record(item.structuredContent) !== null &&
    record(item.interactionConfig) !== null &&
    Array.isArray(item.safetyNotes) &&
    item.safetyNotes.every((note) => typeof note === 'string') &&
    nullableDateTime(item.sourceRetrievedAt) &&
    (item.sourceContentHash === null ||
      (typeof item.sourceContentHash === 'string' &&
        /^[a-f0-9]{64}$/.test(item.sourceContentHash))) &&
    typeof item.contentVersionLabel === 'string' &&
    ['REVIEWED', 'REVIEW_REQUIRED', 'NEEDS_SOURCE_REVIEW'].includes(
      item.sourceReviewStatus as string,
    )
  )
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

export function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false
  const instant = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  )
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
    !validResourceExperience(item) ||
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
    !validOptionalResourceDetailExperience(item) ||
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
    (item.version as number) < 0 ||
    typeof item.isCorrectionDraft !== 'boolean' ||
    !(
      item.reviewDecision === null ||
      (parseResourceReviewDecision(item.reviewDecision) !== null &&
        record(item.reviewDecision)?.contentVersion === item.contentVersion)
    )
  ) {
    return null
  }
  return item as AdminResourceDetail
}

export function parseResourceReviewDecision(
  value: unknown,
): ResourceReviewDecision | null {
  const item = record(value)
  if (
    !item ||
    typeof item.resourceId !== 'string' ||
    !UUID.test(item.resourceId) ||
    typeof item.contentVersion !== 'string' ||
    !CONTENT_VERSION.test(item.contentVersion) ||
    !['APPROVED', 'REJECTED'].includes(item.decision as string) ||
    typeof item.reasonCode !== 'string' ||
    typeof item.authorityVersion !== 'string' ||
    typeof item.reviewedBy !== 'string' ||
    !UUID.test(item.reviewedBy) ||
    !dateTime(item.reviewedAt)
  ) {
    return null
  }
  return item as ResourceReviewDecision
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

export function parseResourceProgressItem(
  value: unknown,
): ResourceProgressItem | null {
  const item = record(value)
  if (
    !item ||
    !exactKeys(item, [
      'resourceId',
      'localDate',
      'contentVersion',
      'status',
      'completedActionIds',
      'completedAt',
      'updatedAt',
      'version',
    ]) ||
    typeof item.resourceId !== 'string' ||
    !UUID.test(item.resourceId) ||
    typeof item.localDate !== 'string' ||
    !isLocalDate(item.localDate) ||
    typeof item.contentVersion !== 'string' ||
    !CONTENT_VERSION.test(item.contentVersion) ||
    typeof item.status !== 'string' ||
    !PROGRESS_STATUSES.has(item.status) ||
    !Array.isArray(item.completedActionIds) ||
    item.completedActionIds.length > 32 ||
    !item.completedActionIds.every(
      (entry) => typeof entry === 'string' && ACTION_ID.test(entry),
    ) ||
    new Set(item.completedActionIds).size !== item.completedActionIds.length ||
    !nullableDateTime(item.completedAt) ||
    !dateTime(item.updatedAt) ||
    typeof item.version !== 'string' ||
    !CONTENT_VERSION.test(item.version)
  ) {
    return null
  }
  if (
    item.status === 'COMPLETED'
      ? item.completedAt === null
      : item.completedAt !== null
  ) {
    return null
  }
  return item as ResourceProgressItem
}

export function parseResourceJourney(value: unknown): ResourceJourney | null {
  const journey = record(value)
  if (
    !journey ||
    typeof journey.assignmentId !== 'string' ||
    !UUID.test(journey.assignmentId) ||
    typeof journey.localDate !== 'string' ||
    !isLocalDate(journey.localDate) ||
    typeof journey.planId !== 'string' ||
    !UUID.test(journey.planId) ||
    !Number.isSafeInteger(journey.planVersion) ||
    (journey.planVersion as number) < 1 ||
    !Number.isSafeInteger(journey.planDay) ||
    (journey.planDay as number) < 1 ||
    (journey.planDay as number) > 14 ||
    ![
      'ORIENTATION',
      'CORE_PRACTICE',
      'REINFORCEMENT',
      'MAINTENANCE',
      'REVIEW',
    ].includes(journey.planStage as string) ||
    !Array.isArray(journey.items) ||
    journey.items.length > 4 ||
    !journey.items.every((entry) => {
      const item = record(entry)
      return (
        item !== null &&
        Number.isSafeInteger(item.position) &&
        typeof item.reason === 'string' &&
        ['PLAN_SELECTED', 'PLAN_DOMAIN', 'CONTINUITY', 'BALANCE'].includes(
          item.reason,
        ) &&
        parseResourceSummary(item.resource) !== null
      )
    }) ||
    typeof journey.weekStart !== 'string' ||
    !isLocalDate(journey.weekStart) ||
    !Array.isArray(journey.bingo) ||
    journey.bingo.length > 9 ||
    !journey.bingo.every((entry) => {
      const item = record(entry)
      return (
        item !== null &&
        Number.isSafeInteger(item.position) &&
        typeof item.resourceId === 'string' &&
        UUID.test(item.resourceId) &&
        typeof item.label === 'string' &&
        typeof item.stamped === 'boolean'
      )
    })
  ) {
    return null
  }
  const progress = record(journey.progress)
  if (
    !progress ||
    ![
      progress.dailyCompleted,
      progress.dailyTotal,
      progress.learningCompleted,
      progress.learningTotal,
      progress.practiceStreakDays,
    ].every((entry) => Number.isSafeInteger(entry) && (entry as number) >= 0)
  ) {
    return null
  }
  return journey as ResourceJourney
}

export function parseResourceProgressList(
  value: unknown,
): ResourceProgressList | null {
  const list = record(value)
  if (
    !list ||
    !exactKeys(list, ['items']) ||
    !Array.isArray(list.items) ||
    !list.items.every((item) => parseResourceProgressItem(item) !== null)
  ) {
    return null
  }
  return list as ResourceProgressList
}

export function parseResourceBookmark(value: unknown): ResourceBookmark | null {
  const item = record(value)
  if (
    !item ||
    !exactKeys(item, ['resourceId', 'contentVersion', 'savedAt', 'version']) ||
    typeof item.resourceId !== 'string' ||
    !UUID.test(item.resourceId) ||
    typeof item.contentVersion !== 'string' ||
    !CONTENT_VERSION.test(item.contentVersion) ||
    !dateTime(item.savedAt) ||
    typeof item.version !== 'string' ||
    !CONTENT_VERSION.test(item.version)
  ) {
    return null
  }
  return item as ResourceBookmark
}

export function parseResourceBookmarkList(
  value: unknown,
): ResourceBookmarkList | null {
  const list = record(value)
  if (
    !list ||
    !exactKeys(list, ['items']) ||
    !Array.isArray(list.items) ||
    list.items.length > 1000 ||
    !list.items.every((item) => parseResourceBookmark(item) !== null)
  ) {
    return null
  }
  return list as ResourceBookmarkList
}

export function parseResourceBingoBoard(
  value: unknown,
): ResourceBingoBoard | null {
  const board = record(value)
  if (
    !board ||
    !exactKeys(board, [
      'weekStart',
      'timeZone',
      'version',
      'updatedAt',
      'items',
    ]) ||
    typeof board.weekStart !== 'string' ||
    !isLocalDate(board.weekStart) ||
    new Date(`${board.weekStart}T00:00:00.000Z`).getUTCDay() !== 1 ||
    typeof board.timeZone !== 'string' ||
    board.timeZone.length < 1 ||
    board.timeZone.length > 64 ||
    typeof board.version !== 'string' ||
    !CONTENT_VERSION.test(board.version) ||
    !dateTime(board.updatedAt) ||
    !Array.isArray(board.items) ||
    board.items.length > 9
  ) {
    return null
  }
  const positions = new Set<number>()
  const resources = new Set<string>()
  for (const value of board.items) {
    const item = record(value)
    if (
      !item ||
      !exactKeys(item, [
        'position',
        'resourceId',
        'contentVersion',
        'label',
        'evidence',
        'selfConfirmedAt',
        'verifiedAt',
        'verificationSource',
      ]) ||
      !Number.isSafeInteger(item.position) ||
      (item.position as number) < 1 ||
      (item.position as number) > 9 ||
      positions.has(item.position as number) ||
      typeof item.resourceId !== 'string' ||
      !UUID.test(item.resourceId) ||
      resources.has(item.resourceId) ||
      typeof item.contentVersion !== 'string' ||
      !CONTENT_VERSION.test(item.contentVersion) ||
      typeof item.label !== 'string' ||
      item.label.length < 1 ||
      item.label.length > 300 ||
      !['NONE', 'SELF_CONFIRMED', 'CONTENT_VERIFIED'].includes(
        item.evidence as string,
      ) ||
      !nullableDateTime(item.selfConfirmedAt) ||
      !nullableDateTime(item.verifiedAt) ||
      !(
        item.verificationSource === null ||
        item.verificationSource === 'RESOURCE_COMPLETION' ||
        item.verificationSource === 'PRACTICE_SESSION'
      )
    ) {
      return null
    }
    if (
      (item.evidence === 'NONE' &&
        (item.selfConfirmedAt !== null ||
          item.verifiedAt !== null ||
          item.verificationSource !== null)) ||
      (item.evidence === 'SELF_CONFIRMED' &&
        (item.selfConfirmedAt === null ||
          item.verifiedAt !== null ||
          item.verificationSource !== null)) ||
      (item.evidence === 'CONTENT_VERIFIED' &&
        (item.verifiedAt === null || item.verificationSource === null))
    ) {
      return null
    }
    positions.add(item.position as number)
    resources.add(item.resourceId)
  }
  return board as ResourceBingoBoard
}

export function parseResourceBingoSelfConfirmationUpdate(
  value: unknown,
): ResourceBingoSelfConfirmationUpdate | null {
  const update = record(value)
  return update &&
    exactKeys(update, ['selfConfirmed']) &&
    Object.keys(update).length === 1 &&
    typeof update.selfConfirmed === 'boolean'
    ? (update as ResourceBingoSelfConfirmationUpdate)
    : null
}

export function parseAchievementCollection(
  value: unknown,
): AchievementCollection | null {
  const collection = record(value)
  if (
    !collection ||
    !exactKeys(collection, [
      'visibilityState',
      'preferenceVersion',
      'policyVersion',
      'calculatedAt',
      'sources',
      'items',
    ]) ||
    !['VISIBLE', 'HIDDEN'].includes(collection.visibilityState as string) ||
    typeof collection.preferenceVersion !== 'string' ||
    !CONTENT_VERSION.test(collection.preferenceVersion) ||
    collection.policyVersion !== 'achievement-rules-v1' ||
    !dateTime(collection.calculatedAt) ||
    !Array.isArray(collection.sources) ||
    collection.sources.length !== 4 ||
    !Array.isArray(collection.items) ||
    collection.items.length !== 11
  ) {
    return null
  }

  const sourceDomains = new Set<string>()
  for (const sourceValue of collection.sources) {
    const source = record(sourceValue)
    if (
      !source ||
      !exactKeys(source, ['domain', 'availability', 'asOfLocalDate']) ||
      !['JOURNAL', 'EMOTION_CHECK_IN', 'RESOURCE', 'JOURNEY'].includes(
        source.domain as string,
      ) ||
      sourceDomains.has(source.domain as string) ||
      !['AVAILABLE', 'UNAVAILABLE', 'DEFERRED'].includes(
        source.availability as string,
      ) ||
      !(
        source.asOfLocalDate === null ||
        (typeof source.asOfLocalDate === 'string' &&
          isLocalDate(source.asOfLocalDate))
      )
    ) {
      return null
    }
    sourceDomains.add(source.domain as string)
  }

  const definitionIds = new Set<string>()
  for (const itemValue of collection.items) {
    const item = record(itemValue)
    if (
      !item ||
      !exactKeys(item, [
        'definitionId',
        'domain',
        'kind',
        'tier',
        'title',
        'description',
        'status',
        'evidenceClass',
        'unlockedAt',
        'ruleVersion',
        'privacy',
        'progress',
      ]) ||
      typeof item.definitionId !== 'string' ||
      !/^[a-z]+[a-z0-9.-]{2,79}$/.test(item.definitionId) ||
      definitionIds.has(item.definitionId) ||
      !['JOURNAL', 'EMOTION_CHECK_IN', 'RESOURCE', 'JOURNEY'].includes(
        item.domain as string,
      ) ||
      !['MILESTONE', 'CONSISTENCY', 'JOURNEY'].includes(item.kind as string) ||
      !['FIRST_STEP', 'STEADY_STEP', 'DEEPENING_STEP', 'JOURNEY'].includes(
        item.tier as string,
      ) ||
      typeof item.title !== 'string' ||
      item.title.length < 1 ||
      typeof item.description !== 'string' ||
      item.description.length < 1 ||
      ![
        'EARNED',
        'UNEARNED',
        'SOURCE_UNAVAILABLE',
        'GRANDFATHERED',
        'DEFERRED',
      ].includes(item.status as string) ||
      ![
        'OWNER_SOURCE_FACT',
        'OWNER_STREAK_MILESTONE',
        'OWNER_PRACTICE_WINDOW',
        'USER_CONFIRMED_JOURNEY',
      ].includes(item.evidenceClass as string) ||
      !nullableDateTime(item.unlockedAt) ||
      item.ruleVersion !== 'achievement-rules-v1' ||
      item.privacy !== 'PRIVATE'
    ) {
      return null
    }
    if (item.progress !== null) {
      const progress = record(item.progress)
      if (
        !progress ||
        !exactKeys(progress, ['current', 'target', 'unit']) ||
        !Number.isSafeInteger(progress.current) ||
        (progress.current as number) < 0 ||
        !Number.isSafeInteger(progress.target) ||
        (progress.target as number) < 1 ||
        (progress.current as number) > (progress.target as number) ||
        ![
          'EVENT',
          'CONSECUTIVE_DAY',
          'DISTINCT_RESOURCE',
          'PRACTICE_DAY',
        ].includes(progress.unit as string)
      ) {
        return null
      }
    }
    if (
      ['EARNED', 'GRANDFATHERED'].includes(item.status as string) !==
        (item.unlockedAt !== null) ||
      (['SOURCE_UNAVAILABLE', 'DEFERRED'].includes(item.status as string) &&
        item.progress !== null)
    ) {
      return null
    }
    definitionIds.add(item.definitionId)
  }
  return collection as AchievementCollection
}

export function parseAchievementPreferenceUpdate(
  value: unknown,
): AchievementPreferenceUpdate | null {
  const item = record(value)
  return item &&
    exactKeys(item, ['visibilityState']) &&
    Object.keys(item).length === 1 &&
    ['VISIBLE', 'HIDDEN'].includes(item.visibilityState as string)
    ? (item as AchievementPreferenceUpdate)
    : null
}

export function parseResourceProgressUpdate(
  value: unknown,
): ResourceProgressUpdate | null {
  const update = record(value)
  if (
    !update ||
    !exactKeys(update, [
      'status',
      'completedActionIds',
      'practiceSessionId',
      'practiceStartedAt',
      'practiceDurationSeconds',
    ]) ||
    typeof update.status !== 'string' ||
    !PROGRESS_STATUSES.has(update.status) ||
    !Array.isArray(update.completedActionIds) ||
    update.completedActionIds.length > 32 ||
    !update.completedActionIds.every(
      (entry) => typeof entry === 'string' && ACTION_ID.test(entry),
    ) ||
    new Set(update.completedActionIds).size !==
      update.completedActionIds.length ||
    !(
      update.practiceSessionId === undefined ||
      (typeof update.practiceSessionId === 'string' &&
        UUID.test(update.practiceSessionId))
    ) ||
    !(
      update.practiceStartedAt === undefined ||
      dateTime(update.practiceStartedAt)
    ) ||
    !(
      update.practiceDurationSeconds === undefined ||
      (Number.isSafeInteger(update.practiceDurationSeconds) &&
        (update.practiceDurationSeconds as number) >= 1 &&
        (update.practiceDurationSeconds as number) <= 7_200)
    ) ||
    ((update.practiceStartedAt !== undefined ||
      update.practiceDurationSeconds !== undefined) &&
      update.practiceSessionId === undefined)
  ) {
    return null
  }
  return update as ResourceProgressUpdate
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const EMAIL_CADENCES = new Set(['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST'])

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((key) => allowed.includes(key))
}

// Like exactKeys but also permits the optional appointmentRemindersEnabled field
// that was added in MB-517. Old backends omit it; new backends include it.
const EMAIL_REQUIRED_KEYS = [
  'cadence',
  'wellbeingDigestEnabled',
  'resourceRemindersEnabled',
  'dailyDigestTime',
  'resourceReminderTime',
] as const
const EMAIL_ALLOWED_KEYS = [
  ...EMAIL_REQUIRED_KEYS,
  'appointmentRemindersEnabled',
] as const

function allowedEmailKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value)
  return (
    EMAIL_REQUIRED_KEYS.every((key) => key in value) &&
    keys.every((key) => (EMAIL_ALLOWED_KEYS as readonly string[]).includes(key))
  )
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
        'communityInteraction',
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
    !allowedEmailKeys(email) ||
    typeof email.cadence !== 'string' ||
    !EMAIL_CADENCES.has(email.cadence) ||
    typeof email.wellbeingDigestEnabled !== 'boolean' ||
    typeof email.resourceRemindersEnabled !== 'boolean' ||
    (email.appointmentRemindersEnabled !== undefined &&
      typeof email.appointmentRemindersEnabled !== 'boolean') ||
    typeof email.dailyDigestTime !== 'string' ||
    !TIME.test(email.dailyDigestTime) ||
    typeof email.resourceReminderTime !== 'string' ||
    !TIME.test(email.resourceReminderTime) ||
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
          'communityInteraction',
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
        'appointmentRemindersEnabled',
        'dailyDigestTime',
        'resourceReminderTime',
      ]) ||
      (email.cadence !== undefined &&
        (typeof email.cadence !== 'string' ||
          !EMAIL_CADENCES.has(email.cadence))) ||
      (email.wellbeingDigestEnabled !== undefined &&
        typeof email.wellbeingDigestEnabled !== 'boolean') ||
      (email.resourceRemindersEnabled !== undefined &&
        typeof email.resourceRemindersEnabled !== 'boolean') ||
      (email.appointmentRemindersEnabled !== undefined &&
        typeof email.appointmentRemindersEnabled !== 'boolean') ||
      (email.dailyDigestTime !== undefined &&
        (typeof email.dailyDigestTime !== 'string' ||
          !TIME.test(email.dailyDigestTime))) ||
      (email.resourceReminderTime !== undefined &&
        (typeof email.resourceReminderTime !== 'string' ||
          !TIME.test(email.resourceReminderTime)))
    ) {
      return null
    }
  }
  return item as NotificationPreferencePatch
}

export function parseWellbeingDigestPreview(
  value: unknown,
): WellbeingDigestPreview | null {
  const item = record(value)
  if (
    !item ||
    !exactKeys(item, [
      'localDate',
      'timeZone',
      'scheduledTime',
      'eligibleNow',
      'resourceItems',
      'includeJournalPrompt',
      'includeEmotionPrompt',
      'empty',
    ]) ||
    typeof item.localDate !== 'string' ||
    !isLocalDate(item.localDate) ||
    typeof item.timeZone !== 'string' ||
    item.timeZone.length < 1 ||
    item.timeZone.length > 64 ||
    typeof item.scheduledTime !== 'string' ||
    !TIME.test(item.scheduledTime) ||
    typeof item.eligibleNow !== 'boolean' ||
    typeof item.includeJournalPrompt !== 'boolean' ||
    typeof item.includeEmotionPrompt !== 'boolean' ||
    typeof item.empty !== 'boolean' ||
    !Array.isArray(item.resourceItems) ||
    item.resourceItems.length > 8 ||
    !item.resourceItems.every((entry) => {
      const resource = record(entry)
      return (
        resource &&
        exactKeys(resource, ['id', 'title']) &&
        typeof resource.id === 'string' &&
        UUID.test(resource.id) &&
        typeof resource.title === 'string' &&
        resource.title.length > 0 &&
        resource.title.length <= 255
      )
    })
  )
    return null
  return item as WellbeingDigestPreview
}

const NOTIFICATION_KINDS = new Set([
  'REMINDER',
  'MESSAGE',
  'APPOINTMENT',
  'SYSTEM_RESOURCE',
  'ASSESSMENT_REASSESSMENT',
  'STREAK_MILESTONE',
  'JOURNAL_REMINDER',
  'EMOTION_CHECKIN_REMINDER',
  'JOURNAL_STREAK_MILESTONE',
  'EMOTION_STREAK_MILESTONE',
  'COMMUNITY_COMMENT',
  'COMMUNITY_REPLY',
  'COMMUNITY_REACTION',
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
    } else if (action.type === 'OPEN_COMMUNITY_POST') {
      if (typeof action.targetId !== 'string' || !UUID.test(action.targetId))
        return null
      if (action.href !== `/community/${action.targetId}`) return null
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
