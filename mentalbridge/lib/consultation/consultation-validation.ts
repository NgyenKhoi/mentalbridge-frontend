export const SUPPORT_AREAS = [
  'DEPRESSIVE_SYMPTOMS',
  'ANXIETY_SYMPTOMS',
] as const
export const LANGUAGES = ['vi', 'en'] as const
export type SupportArea = (typeof SUPPORT_AREAS)[number]
export type SpecialistApprovalStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export const SPECIALIST_APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const
export const SPECIALIST_REJECTION_REASONS = [
  'PROFILE_INFORMATION_INCOMPLETE',
  'PROFILE_CONTENT_NOT_APPROVED',
  'OUTSIDE_SUPPORTED_SCOPE',
] as const
export const SPECIALIST_SUSPENSION_REASONS = [
  'POLICY_VIOLATION',
  'QUALITY_REVIEW_REQUIRED',
  'ACCOUNT_REVIEW_REQUIRED',
] as const
export type SpecialistRejectionReason =
  (typeof SPECIALIST_REJECTION_REASONS)[number]
export type SpecialistSuspensionReason =
  (typeof SPECIALIST_SUSPENSION_REASONS)[number]
export type SpecialistDecisionReason =
  SpecialistRejectionReason | SpecialistSuspensionReason

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
    decisionReasonCode: SpecialistDecisionReason | null
    createdAt: string
    updatedAt: string
    version: number
  }>

export type SpecialistProfiles = Readonly<{
  items: SpecialistProfile[]
  count: number
}>
export type PendingProfiles = SpecialistProfiles

export type SpecialistSuspensionResult = Readonly<{
  profile: SpecialistProfile
  effects: Readonly<{
    withdrawnAvailabilitySlots: number
    cancelledAppointments: number
    releasedCredits: number
  }>
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

export type AppointmentModality = 'IN_APP_CHAT' | 'IN_APP_VIDEO'
export type AppointmentRequestInput = Readonly<{
  slotId: string
  modality: AppointmentModality
  replacesAppointmentId?: string | null
}>
export type BookableSlot = Readonly<{
  id: string
  specialistAccountId: string
  specialistDisplayName: string
  startAt: string
  endAt: string
  timezone: string
  modality: AppointmentModality
}>
export type BookableSlotList = Readonly<{
  items: BookableSlot[]
  count: number
  generatedAt: string
  videoEnabled: boolean
}>
export type Appointment = Readonly<{
  id: string
  slotId: string
  specialistAccountId: string
  specialistDisplayName: string
  status:
    | 'REQUESTED'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'REJECTED'
    | 'EXPIRED'
    | 'CANCELLED'
  modality: AppointmentModality
  scheduledStartAt: string
  scheduledEndAt: string
  timezone: string
  requestedAt: string
  decisionDeadlineAt: string
  heldCreditId: string
  replacesAppointmentId: string | null
  decidedAt: string | null
  decisionReason:
    | 'SPECIALIST_ACCEPTED'
    | 'SPECIALIST_REJECTED'
    | 'DECISION_DEADLINE_EXPIRED'
    | null
  creditState: 'AVAILABLE' | 'HELD' | 'CONSUMED' | 'FORFEITED'
  version: number
}>
export type AppointmentList = Readonly<{
  items: Appointment[]
  count: number
  generatedAt: string
}>

export type ServicePackage = 'FREE' | 'PLUS' | 'PREMIUM'
export type CreditSource = 'DEFAULT_FREE' | 'DEMO' | 'PAID'
export type ConsultationCreditPolicyVersion =
  'consultation-credit-v1' | 'consultation-credit-v2'
export type CreditEventType =
  'PROVISIONED' | 'HELD' | 'CONSUMED' | 'RELEASED' | 'FORFEITED'

export type ServiceCreditAccount = Readonly<{
  accountId: string
  packageCode: ServicePackage
  source: CreditSource
  sourceReference: string | null
  periodStart: string | null
  periodEnd: string | null
  policyVersion: ConsultationCreditPolicyVersion
  balance: Readonly<{
    available: number
    held: number
    consumed: number
    forfeited: number
    total: number
    releasedTransitions: number
  }>
  reservationCapacity: Readonly<{
    active: number
    maximum: number
    remaining: number
  }>
  history: ReadonlyArray<
    Readonly<{
      eventId: string
      creditId: string
      eventType: CreditEventType
      source: CreditSource
      packageCode: ServicePackage
      policyVersion: ConsultationCreditPolicyVersion
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
    !SPECIALIST_APPROVAL_STATUSES.includes(
      item.approvalStatus as SpecialistApprovalStatus,
    ) ||
    !instantOrNull(item.submittedAt) ||
    !instantOrNull(item.reviewedAt) ||
    !(item.reviewedBy === null || uuid(item.reviewedBy)) ||
    !validProfileDecisionReason(item.approvalStatus, item.decisionReasonCode) ||
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

function validProfileDecisionReason(status: unknown, reason: unknown) {
  if (status === 'REJECTED')
    return SPECIALIST_REJECTION_REASONS.includes(
      reason as SpecialistRejectionReason,
    )
  if (status === 'SUSPENDED')
    return SPECIALIST_SUSPENSION_REASONS.includes(
      reason as SpecialistSuspensionReason,
    )
  return reason === null
}

export function parseSpecialistSuspensionResult(
  value: unknown,
): SpecialistSuspensionResult | null {
  const result = record(value)
  const profile = parseProfile(result?.profile)
  const effects = record(result?.effects)
  if (
    !result ||
    !profile ||
    profile.approvalStatus !== 'SUSPENDED' ||
    !effects ||
    ![
      'withdrawnAvailabilitySlots',
      'cancelledAppointments',
      'releasedCredits',
    ].every(
      (key) => Number.isInteger(effects[key]) && Number(effects[key]) >= 0,
    ) ||
    effects.cancelledAppointments !== effects.releasedCredits
  )
    return null
  return {
    profile,
    effects: {
      withdrawnAvailabilitySlots: Number(effects.withdrawnAvailabilitySlots),
      cancelledAppointments: Number(effects.cancelledAppointments),
      releasedCredits: Number(effects.releasedCredits),
    },
  }
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
  const reservationCapacity = record(account?.reservationCapacity)
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
    !['consultation-credit-v1', 'consultation-credit-v2'].includes(
      String(account.policyVersion),
    ) ||
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
    Number(balance.total) > 10 ||
    Number(balance.available) +
      Number(balance.held) +
      Number(balance.consumed) +
      Number(balance.forfeited) !==
      Number(balance.total) ||
    !reservationCapacity ||
    !['active', 'maximum', 'remaining'].every(
      (key) =>
        Number.isInteger(reservationCapacity[key]) &&
        Number(reservationCapacity[key]) >= 0,
    ) ||
    Number(reservationCapacity.maximum) > 4 ||
    Number(reservationCapacity.remaining) >
      Number(reservationCapacity.maximum) ||
    Number(reservationCapacity.remaining) !==
      Math.max(
        0,
        Number(reservationCapacity.maximum) -
          Number(reservationCapacity.active),
      ) ||
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
      !['consultation-credit-v1', 'consultation-credit-v2'].includes(
        String(event.policyVersion),
      ) ||
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

function parseBookableSlot(value: unknown): BookableSlot | null {
  const slot = record(value)
  if (
    !slot ||
    !uuid(slot.id) ||
    !uuid(slot.specialistAccountId) ||
    typeof slot.specialistDisplayName !== 'string' ||
    !utcInstant(slot.startAt) ||
    !utcInstant(slot.endAt) ||
    Date.parse(slot.endAt) - Date.parse(slot.startAt) !== 3_600_000 ||
    !ianaTimezone(slot.timezone) ||
    !AVAILABILITY_MODALITIES.includes(slot.modality as AppointmentModality)
  )
    return null
  return slot as BookableSlot
}

export function parseBookableSlotList(value: unknown): BookableSlotList | null {
  const result = record(value)
  if (
    !result ||
    !Array.isArray(result.items) ||
    result.items.length > 200 ||
    result.count !== result.items.length ||
    !utcInstant(result.generatedAt) ||
    typeof result.videoEnabled !== 'boolean'
  )
    return null
  const items = result.items.map(parseBookableSlot)
  if (items.some((item) => item === null)) return null
  return { ...result, items } as BookableSlotList
}

export function parseAppointment(value: unknown): Appointment | null {
  const item = record(value)
  if (
    !item ||
    !uuid(item.id) ||
    !uuid(item.slotId) ||
    !uuid(item.specialistAccountId) ||
    typeof item.specialistDisplayName !== 'string' ||
    ![
      'REQUESTED',
      'CONFIRMED',
      'IN_PROGRESS',
      'REJECTED',
      'EXPIRED',
      'CANCELLED',
    ].includes(String(item.status)) ||
    !AVAILABILITY_MODALITIES.includes(item.modality as AppointmentModality) ||
    !utcInstant(item.scheduledStartAt) ||
    !utcInstant(item.scheduledEndAt) ||
    !ianaTimezone(item.timezone) ||
    !utcInstant(item.requestedAt) ||
    !utcInstant(item.decisionDeadlineAt) ||
    !uuid(item.heldCreditId) ||
    !(
      item.replacesAppointmentId === null || uuid(item.replacesAppointmentId)
    ) ||
    !(item.decidedAt === null || utcInstant(item.decidedAt)) ||
    ![
      'SPECIALIST_ACCEPTED',
      'SPECIALIST_REJECTED',
      'DECISION_DEADLINE_EXPIRED',
      null,
    ].includes(item.decisionReason as string | null) ||
    !['AVAILABLE', 'HELD', 'CONSUMED', 'FORFEITED'].includes(
      String(item.creditState),
    ) ||
    !Number.isInteger(item.version) ||
    Number(item.version) < 0 ||
    !validAppointmentOutcome(item)
  )
    return null
  return item as Appointment
}

function validAppointmentOutcome(item: Record<string, unknown>) {
  if (item.status === 'REQUESTED')
    return (
      item.decidedAt === null &&
      item.decisionReason === null &&
      item.creditState === 'HELD'
    )
  if (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS')
    return (
      item.decidedAt !== null &&
      item.decisionReason === 'SPECIALIST_ACCEPTED' &&
      item.creditState === 'HELD'
    )
  if (item.status === 'REJECTED')
    return (
      item.decidedAt !== null &&
      item.decisionReason === 'SPECIALIST_REJECTED' &&
      item.creditState === 'AVAILABLE'
    )
  if (item.status === 'EXPIRED')
    return (
      item.decidedAt !== null &&
      item.decisionReason === 'DECISION_DEADLINE_EXPIRED' &&
      item.creditState === 'AVAILABLE'
    )
  return true
}

export function parseAppointmentList(value: unknown): AppointmentList | null {
  const result = record(value)
  if (
    !result ||
    !Array.isArray(result.items) ||
    result.items.length > 100 ||
    result.count !== result.items.length ||
    !utcInstant(result.generatedAt)
  )
    return null
  const items = result.items.map(parseAppointment)
  if (items.some((item) => item === null)) return null
  return { ...result, items } as AppointmentList
}

export function parseAppointmentRequestInput(
  value: unknown,
): AppointmentRequestInput {
  const input = record(value)
  if (!input) throw new ConsultationInputError('body')
  const keys = Object.keys(input)
  if (
    keys.length < 2 ||
    keys.length > 3 ||
    !keys.every((key) =>
      ['slotId', 'modality', 'replacesAppointmentId'].includes(key),
    ) ||
    !uuid(input.slotId)
  )
    throw new ConsultationInputError('slotId')
  if (!AVAILABILITY_MODALITIES.includes(input.modality as AppointmentModality))
    throw new ConsultationInputError('modality')
  if (
    input.replacesAppointmentId !== undefined &&
    input.replacesAppointmentId !== null &&
    !uuid(input.replacesAppointmentId)
  )
    throw new ConsultationInputError('replacesAppointmentId')
  return {
    slotId: input.slotId,
    modality: input.modality as AppointmentModality,
    ...(input.replacesAppointmentId === undefined
      ? {}
      : { replacesAppointmentId: input.replacesAppointmentId }),
  }
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

export function validSpecialistStatus(
  value: string | null,
): value is SpecialistApprovalStatus {
  return SPECIALIST_APPROVAL_STATUSES.includes(
    value as SpecialistApprovalStatus,
  )
}

export function parseSpecialistDecisionInput(
  value: unknown,
  kind: 'REJECTION' | 'SUSPENSION',
): Readonly<{ reasonCode: SpecialistDecisionReason }> {
  const input = record(value)
  if (!input || Object.keys(input).length !== 1)
    throw new ConsultationInputError('body')
  const allowed =
    kind === 'REJECTION'
      ? SPECIALIST_REJECTION_REASONS
      : SPECIALIST_SUSPENSION_REASONS
  if (!allowed.includes(input.reasonCode as never))
    throw new ConsultationInputError('reasonCode')
  return { reasonCode: input.reasonCode as SpecialistDecisionReason }
}

export function validUuid(value: string) {
  return uuid(value)
}
