export const SUPPORT_AREAS = [
  'DEPRESSIVE_SYMPTOMS',
  'ANXIETY_SYMPTOMS',
] as const
export const LANGUAGES = ['vi', 'en'] as const
export type SupportArea = (typeof SUPPORT_AREAS)[number]
export type SpecialistApprovalStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

export type SpecialistProfileInput = Readonly<{
  displayName: string
  bio: string
  supportAreas: SupportArea[]
  languages: string[]
  yearsOfExperience: number
  timezone: string
}>

export type SpecialistProfile = SpecialistProfileInput &
  Readonly<{
    accountId: string
    approvalStatus: SpecialistApprovalStatus
    submittedAt: string | null
    reviewedAt: string | null
    reviewedBy: string | null
    decisionReasonCode: string | null
    createdAt: string
    updatedAt: string
    version: number
  }>

export type PendingProfiles = Readonly<{
  items: SpecialistProfile[]
  count: number
}>

export const AVAILABILITY_MODALITIES = ['IN_APP_CHAT', 'IN_APP_VIDEO'] as const
export const AVAILABILITY_STATUSES = ['ACTIVE', 'WITHDRAWN'] as const
export const AVAILABILITY_READINESS = [
  'AVAILABLE',
  'STARTED',
  'WITHDRAWN',
  'VIDEO_DISABLED',
] as const
export type AvailabilityModality = (typeof AVAILABILITY_MODALITIES)[number]
export type AvailabilitySlotStatus = (typeof AVAILABILITY_STATUSES)[number]
export type AvailabilityReadiness = (typeof AVAILABILITY_READINESS)[number]

export type PublishAvailabilityInput = Readonly<{
  startAt: string
  endAt: string
  timezone: string
  modality: AvailabilityModality
}>

export type AvailabilitySlot = PublishAvailabilityInput &
  Readonly<{
    id: string
    status: AvailabilitySlotStatus
    readiness: AvailabilityReadiness
    withdrawnAt: string | null
    createdAt: string
    updatedAt: string
    version: number
  }>

export type AvailabilitySlotList = Readonly<{
  items: AvailabilitySlot[]
  count: number
  generatedAt: string
  videoPublishingEnabled: boolean
}>

export type ServicePackage = 'FREE' | 'PLUS' | 'PREMIUM'
export type CreditSource = 'DEFAULT_FREE' | 'DEMO' | 'PAID'
export type CreditEventType =
  'PROVISIONED' | 'HELD' | 'CONSUMED' | 'RELEASED' | 'FORFEITED'

export type ServiceCreditAccount = Readonly<{
  accountId: string
  packageCode: ServicePackage
  source: CreditSource
  sourceReference: string | null
  periodStart: string | null
  periodEnd: string | null
  policyVersion: 'consultation-credit-v1'
  balance: Readonly<{
    available: number
    held: number
    consumed: number
    forfeited: number
    total: number
    releasedTransitions: number
  }>
  history: ReadonlyArray<
    Readonly<{
      eventId: string
      creditId: string
      eventType: CreditEventType
      source: CreditSource
      packageCode: ServicePackage
      appointmentId: string | null
      occurredAt: string
    }>
  >
  generatedAt: string
}>

type Problem = Readonly<{
  title: string
  status: number
  code: string
  correlationId?: string
}>

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function instantOrNull(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
  )
}

function utcInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

function ianaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64)
    return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function parseProfile(value: unknown): SpecialistProfile | null {
  const item = record(value)
  if (!item) return null
  if (
    !uuid(item.accountId) ||
    typeof item.displayName !== 'string' ||
    typeof item.bio !== 'string' ||
    !Array.isArray(item.supportAreas) ||
    !item.supportAreas.every((area) =>
      SUPPORT_AREAS.includes(area as SupportArea),
    ) ||
    !Array.isArray(item.languages) ||
    !item.languages.every((language) =>
      LANGUAGES.includes(language as 'vi' | 'en'),
    ) ||
    !Number.isInteger(item.yearsOfExperience) ||
    typeof item.timezone !== 'string' ||
    !['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(
      String(item.approvalStatus),
    ) ||
    !instantOrNull(item.submittedAt) ||
    !instantOrNull(item.reviewedAt) ||
    !(item.reviewedBy === null || uuid(item.reviewedBy)) ||
    !(
      item.decisionReasonCode === null ||
      typeof item.decisionReasonCode === 'string'
    ) ||
    !instantOrNull(item.createdAt) ||
    !instantOrNull(item.updatedAt) ||
    !Number.isInteger(item.version)
  )
    return null
  return item as SpecialistProfile
}

export function parsePendingProfiles(value: unknown): PendingProfiles | null {
  const result = record(value)
  if (
    !result ||
    !Array.isArray(result.items) ||
    !Number.isInteger(result.count)
  )
    return null
  const items = result.items.map(parseProfile)
  if (items.some((item) => item === null)) return null
  return { items: items as SpecialistProfile[], count: result.count as number }
}

export function parseAvailabilitySlot(value: unknown): AvailabilitySlot | null {
  const slot = record(value)
  if (
    !slot ||
    !uuid(slot.id) ||
    !utcInstant(slot.startAt) ||
    !utcInstant(slot.endAt) ||
    Date.parse(slot.endAt) - Date.parse(slot.startAt) !== 60 * 60 * 1000 ||
    !ianaTimezone(slot.timezone) ||
    !AVAILABILITY_MODALITIES.includes(slot.modality as AvailabilityModality) ||
    !AVAILABILITY_STATUSES.includes(slot.status as AvailabilitySlotStatus) ||
    !AVAILABILITY_READINESS.includes(slot.readiness as AvailabilityReadiness) ||
    !(slot.withdrawnAt === null || utcInstant(slot.withdrawnAt)) ||
    !utcInstant(slot.createdAt) ||
    !utcInstant(slot.updatedAt) ||
    !Number.isInteger(slot.version) ||
    Number(slot.version) < 0
  )
    return null
  return slot as AvailabilitySlot
}

export function parseAvailabilitySlotList(
  value: unknown,
): AvailabilitySlotList | null {
  const result = record(value)
  if (
    !result ||
    !Array.isArray(result.items) ||
    result.items.length > 500 ||
    !Number.isInteger(result.count) ||
    result.count !== result.items.length ||
    !utcInstant(result.generatedAt) ||
    typeof result.videoPublishingEnabled !== 'boolean'
  )
    return null
  const items = result.items.map(parseAvailabilitySlot)
  if (items.some((item) => item === null)) return null
  return {
    items: items as AvailabilitySlot[],
    count: result.count as number,
    generatedAt: result.generatedAt,
    videoPublishingEnabled: result.videoPublishingEnabled,
  }
}

export function parseServiceCreditAccount(
  value: unknown,
): ServiceCreditAccount | null {
  const account = record(value)
  const balance = record(account?.balance)
  if (
    !account ||
    !uuid(account.accountId) ||
    !['FREE', 'PLUS', 'PREMIUM'].includes(String(account.packageCode)) ||
    !['DEFAULT_FREE', 'DEMO', 'PAID'].includes(String(account.source)) ||
    !(
      account.sourceReference === null ||
      typeof account.sourceReference === 'string'
    ) ||
    !instantOrNull(account.periodStart) ||
    !instantOrNull(account.periodEnd) ||
    account.policyVersion !== 'consultation-credit-v1' ||
    !balance ||
    ![
      'available',
      'held',
      'consumed',
      'forfeited',
      'total',
      'releasedTransitions',
    ].every(
      (key) => Number.isInteger(balance[key]) && Number(balance[key]) >= 0,
    ) ||
    Number(balance.total) > 3 ||
    Number(balance.available) +
      Number(balance.held) +
      Number(balance.consumed) +
      Number(balance.forfeited) !==
      Number(balance.total) ||
    !Array.isArray(account.history) ||
    account.history.length > 100 ||
    !utcInstant(account.generatedAt)
  )
    return null
  for (const value of account.history) {
    const event = record(value)
    if (
      !event ||
      !uuid(event.eventId) ||
      !uuid(event.creditId) ||
      !['PROVISIONED', 'HELD', 'CONSUMED', 'RELEASED', 'FORFEITED'].includes(
        String(event.eventType),
      ) ||
      !['DEMO', 'PAID'].includes(String(event.source)) ||
      !['PLUS', 'PREMIUM'].includes(String(event.packageCode)) ||
      !(event.appointmentId === null || uuid(event.appointmentId)) ||
      !utcInstant(event.occurredAt)
    )
      return null
  }
  if (
    (account.source === 'DEFAULT_FREE' &&
      (account.packageCode !== 'FREE' ||
        account.sourceReference !== null ||
        account.periodStart !== null ||
        account.periodEnd !== null ||
        Number(balance.total) !== 0)) ||
    (account.source !== 'DEFAULT_FREE' &&
      (account.packageCode === 'FREE' ||
        typeof account.sourceReference !== 'string' ||
        account.periodStart === null ||
        account.periodEnd === null))
  )
    return null
  return account as ServiceCreditAccount
}

export function parseProblem(value: unknown, status: number): Problem | null {
  const problem = record(value)
  if (
    !problem ||
    typeof problem.title !== 'string' ||
    typeof problem.code !== 'string'
  )
    return null
  return {
    title: problem.title,
    code: problem.code,
    status,
    ...(typeof problem.correlationId === 'string'
      ? { correlationId: problem.correlationId }
      : {}),
  }
}

export class ConsultationInputError extends Error {
  constructor(readonly field: string) {
    super(`Invalid ${field}`)
  }
}

export function parsePublishAvailabilityInput(
  value: unknown,
): PublishAvailabilityInput {
  const input = record(value)
  if (!input) throw new ConsultationInputError('body')
  const keys = Object.keys(input)
  if (
    keys.length !== 4 ||
    !keys.every((key) =>
      ['startAt', 'endAt', 'timezone', 'modality'].includes(key),
    )
  )
    throw new ConsultationInputError('body')
  if (!utcInstant(input.startAt)) throw new ConsultationInputError('startAt')
  if (!utcInstant(input.endAt)) throw new ConsultationInputError('endAt')
  if (Date.parse(input.endAt) - Date.parse(input.startAt) !== 60 * 60 * 1000)
    throw new ConsultationInputError('endAt')
  if (!ianaTimezone(input.timezone))
    throw new ConsultationInputError('timezone')
  if (!AVAILABILITY_MODALITIES.includes(input.modality as AvailabilityModality))
    throw new ConsultationInputError('modality')
  return {
    startAt: input.startAt,
    endAt: input.endAt,
    timezone: input.timezone,
    modality: input.modality as AvailabilityModality,
  }
}

export function validIdempotencyKey(value: string | null): value is string {
  return value !== null && /^[!-~]{16,128}$/.test(value)
}

export function validUtcInstant(value: string | null): value is string {
  return value !== null && utcInstant(value)
}

export function parseProfileInput(value: unknown): SpecialistProfileInput {
  const input = record(value)
  if (!input) throw new ConsultationInputError('body')
  const displayName =
    typeof input.displayName === 'string' ? input.displayName.trim() : ''
  const bio = typeof input.bio === 'string' ? input.bio.trim() : ''
  if (displayName.length < 1 || displayName.length > 120)
    throw new ConsultationInputError('displayName')
  if (bio.length < 1 || bio.length > 2000)
    throw new ConsultationInputError('bio')
  if (
    !Array.isArray(input.supportAreas) ||
    input.supportAreas.length < 1 ||
    !input.supportAreas.every((area) =>
      SUPPORT_AREAS.includes(area as SupportArea),
    )
  ) {
    throw new ConsultationInputError('supportAreas')
  }
  if (
    !Array.isArray(input.languages) ||
    input.languages.length < 1 ||
    !input.languages.every((language) =>
      LANGUAGES.includes(language as 'vi' | 'en'),
    )
  ) {
    throw new ConsultationInputError('languages')
  }
  if (
    !Number.isInteger(input.yearsOfExperience) ||
    Number(input.yearsOfExperience) < 0 ||
    Number(input.yearsOfExperience) > 80
  ) {
    throw new ConsultationInputError('yearsOfExperience')
  }
  if (
    typeof input.timezone !== 'string' ||
    input.timezone.length < 3 ||
    input.timezone.length > 80
  ) {
    throw new ConsultationInputError('timezone')
  }
  return {
    displayName,
    bio,
    supportAreas: [...new Set(input.supportAreas as SupportArea[])],
    languages: [...new Set(input.languages as string[])],
    yearsOfExperience: Number(input.yearsOfExperience),
    timezone: input.timezone.trim(),
  }
}

export function validEtag(value: string | null): value is string {
  return value !== null && /^"\d+"$/.test(value)
}

export function validUuid(value: string) {
  return uuid(value)
}
