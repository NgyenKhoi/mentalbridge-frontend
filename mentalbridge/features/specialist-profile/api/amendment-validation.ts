import type { components } from '@/contracts/consultation.generated'
import { parseProfile } from '@/lib/consultation/consultation-validation'

export type ProfileAmendment = components['schemas']['ProfileAmendment']
export type ProfileAmendmentDetail = components['schemas']['ProfileAmendmentDetail']

export function parseProfileAmendment(value: unknown): ProfileAmendment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.version !== 'number' ||
    !['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'APPROVED', 'CANCELLED'].includes(String(item.status)) ||
    !item.proposedProfile || typeof item.proposedProfile !== 'object') return null
  return item as ProfileAmendment
}

export function parseProfileAmendmentDetail(value: unknown): ProfileAmendmentDetail | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (!parseProfile(item.approvedProfile) ||
    !(item.amendment === null || parseProfileAmendment(item.amendment))) return null
  return item as ProfileAmendmentDetail
}
