import type {
  AccountDetail,
  AccountPage,
  AccountStateChangeRequest,
  AccountStatus,
  AccountSummary,
  ChallengeRequest,
  EmailRequest,
  IdentityRole,
  LoginRequest,
  PublicRegistrationRole,
  RegistrationRequest,
  RegistrationResponse,
  TokenPair,
  PasswordResetRequest,
  PasswordChangeRequest,
  PlatformReport,
  PlatformReportPage,
  PlatformReportRequest,
  PlatformReportType,
  ProductJourneyMetrics,
} from '@/features/auth/api/identity-contract'

const ACCOUNT_STATUSES = new Set([
  'PENDING_EMAIL_VERIFICATION',
  'ACTIVE',
  'DISABLED',
  'DELETION_PENDING',
  'DELETED',
])
const IDENTITY_ROLES = new Set<IdentityRole>(['USER', 'SPECIALIST', 'ADMIN'])
const ADMIN_TARGET_STATUSES = new Set(['ACTIVE', 'DISABLED'])
const ACCOUNT_STATE_REASON_CODES = new Set([
  'SAFETY_CONCERN',
  'POLICY_VIOLATION',
  'ACCOUNT_REVIEW_REQUIRED',
  'REVIEW_COMPLETED',
])
const PUBLIC_REGISTRATION_ROLES = new Set<PublicRegistrationRole>([
  'USER',
  'SPECIALIST',
])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PLATFORM_REPORT_STATUSES = new Set([
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'STALE',
])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export type ValidationViolation = Readonly<{
  field: string
  code: string
}>

export type ValidationResult<T> =
  | Readonly<{ success: true; value: T }>
  | Readonly<{ success: false; violations: readonly ValidationViolation[] }>

export function validateLoginRequest(
  value: unknown,
): ValidationResult<LoginRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }

  const violations: ValidationViolation[] = []

  if (!hasOnlyKeys(value, ['email', 'password', 'deviceLabel'])) {
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  }

  if (
    typeof value.email !== 'string' ||
    value.email.length > 254 ||
    !EMAIL_PATTERN.test(value.email)
  ) {
    violations.push({ field: 'email', code: 'INVALID_FORMAT' })
  }

  if (
    typeof value.password !== 'string' ||
    value.password.length < 1 ||
    value.password.length > 128
  ) {
    violations.push({ field: 'password', code: 'INVALID_LENGTH' })
  }

  if (
    value.deviceLabel !== undefined &&
    (typeof value.deviceLabel !== 'string' ||
      value.deviceLabel.length < 1 ||
      value.deviceLabel.length > 120)
  ) {
    violations.push({ field: 'deviceLabel', code: 'INVALID_LENGTH' })
  }

  if (violations.length > 0) return { success: false, violations }

  return {
    success: true,
    value: {
      email: value.email as string,
      password: value.password as string,
      ...(value.deviceLabel === undefined
        ? {}
        : { deviceLabel: value.deviceLabel as string }),
    },
  }
}

export function validateRegistrationRequest(
  value: unknown,
): ValidationResult<RegistrationRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }

  const violations: ValidationViolation[] = []

  if (!hasOnlyKeys(value, ['email', 'password', 'actorType'])) {
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  }

  if (
    typeof value.email !== 'string' ||
    value.email.length > 254 ||
    !EMAIL_PATTERN.test(value.email)
  ) {
    violations.push({ field: 'email', code: 'INVALID_FORMAT' })
  }

  if (
    typeof value.password !== 'string' ||
    Array.from(value.password).length < 12 ||
    Array.from(value.password).length > 128 ||
    new TextEncoder().encode(value.password).byteLength > 72
  ) {
    violations.push({ field: 'password', code: 'INVALID_LENGTH' })
  }

  if (
    typeof value.actorType !== 'string' ||
    !PUBLIC_REGISTRATION_ROLES.has(value.actorType as PublicRegistrationRole)
  ) {
    violations.push({ field: 'actorType', code: 'INVALID_VALUE' })
  }

  if (violations.length > 0) return { success: false, violations }

  return {
    success: true,
    value: {
      email: value.email as string,
      password: value.password as string,
      actorType: value.actorType as PublicRegistrationRole,
    },
  }
}

export function validateChallengeRequest(
  value: unknown,
): ValidationResult<ChallengeRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }

  const violations: ValidationViolation[] = []

  if (!hasOnlyKeys(value, ['challenge'])) {
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  }

  if (
    typeof value.challenge !== 'string' ||
    value.challenge.length < 32 ||
    value.challenge.length > 512
  ) {
    violations.push({ field: 'challenge', code: 'INVALID_LENGTH' })
  }

  if (violations.length > 0) return { success: false, violations }

  return {
    success: true,
    value: { challenge: value.challenge as string },
  }
}

export function validateEmailRequest(
  value: unknown,
): ValidationResult<EmailRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }
  const violations: ValidationViolation[] = []
  if (!hasOnlyKeys(value, ['email']))
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  if (
    typeof value.email !== 'string' ||
    value.email.length > 254 ||
    !EMAIL_PATTERN.test(value.email)
  ) {
    violations.push({ field: 'email', code: 'INVALID_FORMAT' })
  }
  return violations.length > 0
    ? { success: false, violations }
    : { success: true, value: { email: value.email as string } }
}

function validNewPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Array.from(value).length >= 12 &&
    Array.from(value).length <= 128 &&
    new TextEncoder().encode(value).byteLength <= 72
  )
}

export function validatePasswordResetRequest(
  value: unknown,
): ValidationResult<PasswordResetRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }
  const violations: ValidationViolation[] = []
  if (!hasOnlyKeys(value, ['challenge', 'newPassword']))
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  if (
    typeof value.challenge !== 'string' ||
    value.challenge.length < 32 ||
    value.challenge.length > 512
  ) {
    violations.push({ field: 'challenge', code: 'INVALID_LENGTH' })
  }
  if (!validNewPassword(value.newPassword))
    violations.push({ field: 'newPassword', code: 'INVALID_LENGTH' })
  return violations.length > 0
    ? { success: false, violations }
    : {
        success: true,
        value: {
          challenge: value.challenge as string,
          newPassword: value.newPassword as string,
        },
      }
}

export function validatePasswordChangeRequest(
  value: unknown,
): ValidationResult<PasswordChangeRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }
  const violations: ValidationViolation[] = []
  if (!hasOnlyKeys(value, ['currentPassword', 'newPassword']))
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  if (
    typeof value.currentPassword !== 'string' ||
    value.currentPassword.length < 1 ||
    value.currentPassword.length > 128
  ) {
    violations.push({ field: 'currentPassword', code: 'INVALID_LENGTH' })
  }
  if (!validNewPassword(value.newPassword))
    violations.push({ field: 'newPassword', code: 'INVALID_LENGTH' })
  return violations.length > 0
    ? { success: false, violations }
    : {
        success: true,
        value: {
          currentPassword: value.currentPassword as string,
          newPassword: value.newPassword as string,
        },
      }
}

export function isValidIdempotencyKey(value: string | null): value is string {
  return value !== null && /^[!-~]{16,128}$/.test(value)
}

export function parseRegistrationResponse(
  value: unknown,
): RegistrationResponse | null {
  if (!isRecord(value)) return null
  if (
    !hasOnlyKeys(value, [
      'accountId',
      'status',
      'verificationRequired',
      'createdAt',
    ])
  ) {
    return null
  }

  if (
    typeof value.accountId !== 'string' ||
    !UUID_PATTERN.test(value.accountId) ||
    value.status !== 'PENDING_EMAIL_VERIFICATION' ||
    value.verificationRequired !== true ||
    !isDateTime(value.createdAt)
  ) {
    return null
  }

  return value as RegistrationResponse
}

export function parseAccountSummary(value: unknown): AccountSummary | null {
  if (!isRecord(value)) return null
  if (!hasOnlyKeys(value, ['accountId', 'status', 'roles', 'emailVerified'])) {
    return null
  }

  if (
    typeof value.accountId !== 'string' ||
    !UUID_PATTERN.test(value.accountId) ||
    typeof value.status !== 'string' ||
    !ACCOUNT_STATUSES.has(value.status) ||
    !Array.isArray(value.roles) ||
    value.roles.length < 1 ||
    new Set(value.roles).size !== value.roles.length ||
    !value.roles.every(
      (role): role is IdentityRole =>
        typeof role === 'string' && IDENTITY_ROLES.has(role as IdentityRole),
    ) ||
    typeof value.emailVerified !== 'boolean'
  ) {
    return null
  }

  return value as AccountSummary
}

export function parseTokenPair(value: unknown): TokenPair | null {
  if (!isRecord(value)) return null
  if (
    !hasOnlyKeys(value, [
      'accessToken',
      'tokenType',
      'expiresIn',
      'refreshToken',
      'refreshExpiresAt',
    ])
  ) {
    return null
  }

  if (
    typeof value.accessToken !== 'string' ||
    value.accessToken.length < 1 ||
    value.tokenType !== 'Bearer' ||
    value.expiresIn !== 900 ||
    typeof value.refreshToken !== 'string' ||
    value.refreshToken.length < 43 ||
    value.refreshToken.length > 512 ||
    !isDateTime(value.refreshExpiresAt)
  ) {
    return null
  }

  return value as TokenPair
}

export function parseAccountDetail(value: unknown): AccountDetail | null {
  if (!isRecord(value)) return null
  if (
    !hasOnlyKeys(value, [
      'accountId',
      'email',
      'status',
      'roles',
      'emailVerified',
      'createdAt',
      'updatedAt',
      'version',
    ])
  ) {
    return null
  }

  if (
    typeof value.accountId !== 'string' ||
    !UUID_PATTERN.test(value.accountId) ||
    typeof value.email !== 'string' ||
    value.email.length > 254 ||
    !EMAIL_PATTERN.test(value.email) ||
    typeof value.status !== 'string' ||
    !ACCOUNT_STATUSES.has(value.status) ||
    !Array.isArray(value.roles) ||
    value.roles.length < 1 ||
    new Set(value.roles).size !== value.roles.length ||
    !value.roles.every(
      (role): role is IdentityRole =>
        typeof role === 'string' && IDENTITY_ROLES.has(role as IdentityRole),
    ) ||
    typeof value.emailVerified !== 'boolean' ||
    !isDateTime(value.createdAt) ||
    !isDateTime(value.updatedAt) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 0
  ) {
    return null
  }

  return value as AccountDetail
}

export function isUuid(value: string | null): value is string {
  return value !== null && UUID_PATTERN.test(value)
}

export function isValidAccountStatus(value: string): value is AccountStatus {
  return ACCOUNT_STATUSES.has(value)
}

export function isValidIdentityRole(value: string): value is IdentityRole {
  return IDENTITY_ROLES.has(value as IdentityRole)
}

export function isValidEmail(value: string) {
  return value.length <= 254 && EMAIL_PATTERN.test(value)
}

export function parseAccountPage(value: unknown): AccountPage | null {
  if (!isRecord(value)) return null
  if (!hasOnlyKeys(value, ['items', 'nextCursor'])) return null
  if (!Array.isArray(value.items)) return null
  const items: AccountDetail[] = []
  for (const item of value.items) {
    const detail = parseAccountDetail(item)
    if (!detail) return null
    items.push(detail)
  }
  if (value.nextCursor !== null && typeof value.nextCursor !== 'string')
    return null
  return { items, nextCursor: value.nextCursor as string | null }
}

export function validateAccountStateChangeRequest(
  value: unknown,
): ValidationResult<AccountStateChangeRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }
  const violations: ValidationViolation[] = []
  if (!hasOnlyKeys(value, ['status', 'reasonCode'])) {
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  }
  if (
    typeof value.status !== 'string' ||
    !ADMIN_TARGET_STATUSES.has(value.status)
  ) {
    violations.push({ field: 'status', code: 'INVALID_FORMAT' })
  }
  if (
    typeof value.reasonCode !== 'string' ||
    !ACCOUNT_STATE_REASON_CODES.has(value.reasonCode)
  ) {
    violations.push({ field: 'reasonCode', code: 'INVALID_FORMAT' })
  }
  if (violations.length > 0) return { success: false, violations }
  return {
    success: true,
    value: {
      status: value.status as AccountStateChangeRequest['status'],
      reasonCode: value.reasonCode as AccountStateChangeRequest['reasonCode'],
    },
  }
}

export function validatePlatformReportRequest(
  value: unknown,
): ValidationResult<PlatformReportRequest> {
  if (!isRecord(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }
  const violations: ValidationViolation[] = []
  if (!hasOnlyKeys(value, ['reportType', 'periodStart', 'periodEnd'])) {
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  }
  if (value.reportType !== 'ACCOUNT_ACTIVITY') {
    violations.push({ field: 'reportType', code: 'INVALID_VALUE' })
  }
  if (
    typeof value.periodStart !== 'string' ||
    !DATE_PATTERN.test(value.periodStart)
  ) {
    violations.push({ field: 'periodStart', code: 'INVALID_FORMAT' })
  }
  if (
    typeof value.periodEnd !== 'string' ||
    !DATE_PATTERN.test(value.periodEnd)
  ) {
    violations.push({ field: 'periodEnd', code: 'INVALID_FORMAT' })
  }
  if (violations.length > 0) return { success: false, violations }
  return { success: true, value: value as PlatformReportRequest }
}

export function parsePlatformReportType(
  value: unknown,
): PlatformReportType | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'reportType',
      'label',
      'description',
      'scopeVersion',
      'maximumPeriodDays',
    ])
  )
    return null
  if (
    value.reportType !== 'ACCOUNT_ACTIVITY' ||
    typeof value.label !== 'string' ||
    value.label.length > 120 ||
    typeof value.description !== 'string' ||
    value.description.length > 500 ||
    typeof value.scopeVersion !== 'string' ||
    value.scopeVersion.length > 64 ||
    !Number.isInteger(value.maximumPeriodDays) ||
    (value.maximumPeriodDays as number) < 1 ||
    (value.maximumPeriodDays as number) > 366
  )
    return null
  return value as PlatformReportType
}

export function parsePlatformReportCatalogue(
  value: unknown,
): PlatformReportType[] | null {
  if (!Array.isArray(value) || value.length > 20) return null
  const parsed = value.map(parsePlatformReportType)
  return parsed.every((item): item is PlatformReportType => item !== null)
    ? parsed
    : null
}

export function parsePlatformReport(value: unknown): PlatformReport | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'reportId',
      'reportType',
      'scopeVersion',
      'periodStart',
      'periodEnd',
      'requestedBy',
      'requestedAt',
      'status',
      'sourceVersions',
      'retryOf',
      'startedAt',
      'completedAt',
      'failedAt',
      'failureCode',
      'downloadable',
      'fileName',
      'mediaType',
      'contentLength',
      'contentSha256',
      'retainedUntil',
    ])
  )
    return null
  if (
    typeof value.reportId !== 'string' ||
    !UUID_PATTERN.test(value.reportId) ||
    value.reportType !== 'ACCOUNT_ACTIVITY' ||
    typeof value.scopeVersion !== 'string' ||
    typeof value.periodStart !== 'string' ||
    !DATE_PATTERN.test(value.periodStart) ||
    typeof value.periodEnd !== 'string' ||
    !DATE_PATTERN.test(value.periodEnd) ||
    typeof value.requestedBy !== 'string' ||
    !UUID_PATTERN.test(value.requestedBy) ||
    !isDateTime(value.requestedAt) ||
    typeof value.status !== 'string' ||
    !PLATFORM_REPORT_STATUSES.has(value.status) ||
    !isRecord(value.sourceVersions) ||
    Object.values(value.sourceVersions).some(
      (item) => typeof item !== 'string',
    ) ||
    typeof value.downloadable !== 'boolean'
  )
    return null
  for (const field of ['retryOf']) {
    const item = value[field]
    if (item !== null && (typeof item !== 'string' || !UUID_PATTERN.test(item)))
      return null
  }
  for (const field of [
    'startedAt',
    'completedAt',
    'failedAt',
    'retainedUntil',
  ]) {
    const item = value[field]
    if (item !== null && !isDateTime(item)) return null
  }
  if (
    (value.failureCode !== null && typeof value.failureCode !== 'string') ||
    (value.fileName !== null && typeof value.fileName !== 'string') ||
    (value.mediaType !== null && typeof value.mediaType !== 'string') ||
    (value.contentLength !== null &&
      (!Number.isInteger(value.contentLength) ||
        (value.contentLength as number) < 1)) ||
    (value.contentSha256 !== null &&
      (typeof value.contentSha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(value.contentSha256)))
  )
    return null
  return value as PlatformReport
}

export function parsePlatformReportPage(
  value: unknown,
): PlatformReportPage | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['items', 'nextCursor']) ||
    !Array.isArray(value.items)
  )
    return null
  const items = value.items.map(parsePlatformReport)
  if (!items.every((item): item is PlatformReport => item !== null)) return null
  if (value.nextCursor !== null && typeof value.nextCursor !== 'string')
    return null
  return { items, nextCursor: value.nextCursor as string | null }
}

const PRODUCT_JOURNEY_SOURCES = new Set(['IDENTITY', 'CARE', 'CONSULTATION'])
const PRODUCT_JOURNEY_STAGES = new Set([
  'REGISTERED_ACCOUNTS',
  'ACTIVE_REGISTERED_ACCOUNTS',
  'COMPLETED_SCREENING_EPISODES',
  'SUPPORT_GUIDES_GENERATED',
  'SUPPORT_GUIDES_OPENED',
  'PAID_SUPPORT_PLANS_ACTIVATED',
  'CONSULTATIONS_REQUESTED',
  'CONSULTATIONS_CONFIRMED',
  'CONSULTATIONS_COMPLETED',
])

export function parseProductJourneyMetrics(
  value: unknown,
): ProductJourneyMetrics | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'projectionVersion',
      'window',
      'asOf',
      'interpretation',
      'sources',
      'stages',
    ]) ||
    value.projectionVersion !== 'product-journey-metrics-v1' ||
    value.interpretation !==
      'DESCRIPTIVE_PRODUCT_ACTIVITY_NOT_CLINICAL_EFFECTIVENESS' ||
    !isDateTime(value.asOf) ||
    !isRecord(value.window) ||
    !hasOnlyKeys(value.window, ['from', 'to']) ||
    !isDateTime(value.window.from) ||
    !isDateTime(value.window.to) ||
    !Array.isArray(value.sources) ||
    value.sources.length !== 3 ||
    !Array.isArray(value.stages) ||
    value.stages.length !== 9
  )
    return null

  if (
    new Set(
      value.sources.map((source) => (isRecord(source) ? source.source : null)),
    ).size !== 3 ||
    !value.sources.every((source) => {
      if (
        !isRecord(source) ||
        !hasOnlyKeys(source, [
          'source',
          'sourceVersion',
          'status',
          'asOf',
          'unavailableReason',
        ]) ||
        !PRODUCT_JOURNEY_SOURCES.has(String(source.source)) ||
        !['AVAILABLE', 'UNAVAILABLE'].includes(String(source.status))
      )
        return false
      return source.status === 'AVAILABLE'
        ? typeof source.sourceVersion === 'string' &&
            isDateTime(source.asOf) &&
            source.unavailableReason === null
        : source.sourceVersion === null &&
            source.asOf === null &&
            source.unavailableReason === 'DEPENDENCY_UNAVAILABLE'
    })
  )
    return null

  if (
    new Set(value.stages.map((stage) => (isRecord(stage) ? stage.stage : null)))
      .size !== 9 ||
    !value.stages.every((stage) => {
      if (
        !isRecord(stage) ||
        !hasOnlyKeys(stage, [
          'stage',
          'source',
          'status',
          'count',
          'rate',
          'unavailableReason',
        ]) ||
        !PRODUCT_JOURNEY_STAGES.has(String(stage.stage)) ||
        !PRODUCT_JOURNEY_SOURCES.has(String(stage.source)) ||
        !['AVAILABLE', 'UNAVAILABLE'].includes(String(stage.status))
      )
        return false
      if (stage.status === 'AVAILABLE') {
        if (
          !Number.isSafeInteger(stage.count) ||
          Number(stage.count) < 0 ||
          stage.unavailableReason !== null
        )
          return false
      } else if (
        stage.count !== null ||
        stage.rate !== null ||
        ![
          'SOURCE_UNAVAILABLE',
          'AUTHORITATIVE_USAGE_FACT_UNAVAILABLE',
        ].includes(String(stage.unavailableReason))
      )
        return false
      if (stage.rate === null) return true
      if (!isRecord(stage.rate)) return false
      return (
        hasOnlyKeys(stage.rate, ['denominatorStage', 'percentage']) &&
        ['REGISTERED_ACCOUNTS', 'CONSULTATIONS_REQUESTED'].includes(
          String(stage.rate.denominatorStage),
        ) &&
        typeof stage.rate.percentage === 'number' &&
        Number.isFinite(stage.rate.percentage) &&
        stage.rate.percentage >= 0 &&
        stage.rate.percentage <= 100
      )
    })
  )
    return null

  return value as ProductJourneyMetrics
}
