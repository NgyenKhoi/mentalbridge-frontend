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
