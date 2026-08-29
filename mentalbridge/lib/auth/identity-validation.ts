import type {
  AccountDetail,
  AccountSummary,
  ChallengeRequest,
  IdentityRole,
  LoginRequest,
  PublicRegistrationRole,
  RegistrationRequest,
  RegistrationResponse,
  TokenPair,
} from '@/features/auth/api/identity-contract'

const ACCOUNT_STATUSES = new Set([
  'PENDING_EMAIL_VERIFICATION',
  'ACTIVE',
  'DISABLED',
  'DELETION_PENDING',
  'DELETED',
])
const IDENTITY_ROLES = new Set<IdentityRole>(['USER', 'SPECIALIST', 'ADMIN'])
const PUBLIC_REGISTRATION_ROLES = new Set<PublicRegistrationRole>([
  'USER',
  'SPECIALIST',
])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
