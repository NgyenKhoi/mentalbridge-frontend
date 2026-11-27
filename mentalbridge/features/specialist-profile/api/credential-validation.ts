import type { components } from '@/contracts/consultation.generated'

export type CredentialDocument =
  components['schemas']['SpecialistCredentialDocument']
export type CredentialDocumentLink =
  components['schemas']['CredentialDocumentLink']
export type CredentialType = CredentialDocument['credentialType']
export type VerifiedCredentialBadge =
  components['schemas']['VerifiedCredentialBadge']

const credentialTypes: CredentialType[] = ['DEGREE', 'LICENSE', 'CERTIFICATE']
const statuses: CredentialDocument['verificationStatus'][] = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
]

export function parseCredentialDocument(
  value: unknown,
): CredentialDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (
    typeof item.id !== 'string' ||
    typeof item.specialistAccountId !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.issuer !== 'string' ||
    typeof item.issueYear !== 'number' ||
    !credentialTypes.includes(item.credentialType as CredentialType) ||
    typeof item.fileName !== 'string' ||
    typeof item.mediaType !== 'string' ||
    typeof item.fileBytes !== 'number' ||
    !statuses.includes(
      item.verificationStatus as CredentialDocument['verificationStatus'],
    ) ||
    typeof item.badgeVisible !== 'boolean' ||
    !(item.reviewedAt === null || typeof item.reviewedAt === 'string') ||
    typeof item.createdAt !== 'string' ||
    typeof item.version !== 'number'
  )
    return null
  return item as CredentialDocument
}

export function parseCredentialDocuments(
  value: unknown,
): CredentialDocument[] | null {
  if (!Array.isArray(value) || value.length > 100) return null
  const items = value.map(parseCredentialDocument)
  return items.every((item): item is CredentialDocument => item !== null)
    ? items
    : null
}

export function parseCredentialLink(
  value: unknown,
): CredentialDocumentLink | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const url = (value as Record<string, unknown>).url
  if (typeof url !== 'string') return null
  try {
    if (new URL(url).protocol !== 'https:') return null
  } catch {
    return null
  }
  return { url }
}

export function parseVerifiedCredentialBadges(
  value: unknown,
): VerifiedCredentialBadge[] | null {
  if (!Array.isArray(value) || value.length > 100) return null
  if (
    !value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.title === 'string' &&
        item.title.length > 0 &&
        credentialTypes.includes(item.credentialType),
    )
  )
    return null
  return value as VerifiedCredentialBadge[]
}
