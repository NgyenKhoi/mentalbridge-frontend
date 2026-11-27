import type {
  AnalysisJob,
  AnalysisTerminalReason,
  SuggestedAction,
} from '@/lib/journal/journal-contract'
import {
  isJournalId,
  isJournalRevision,
} from '@/lib/journal/journal-validation'

export type StoredAnalysisRequest = Readonly<{
  journalId: string
  journalRevision: number
  requestKey: string
  jobId?: string
}>

export const analysisStorageKey = (journalId: string, revision: number) =>
  `mentalbridge:journal-analysis:${journalId}:${revision}`

export function parseStoredAnalysisRequest(
  value: string | null,
  journalId: string,
  revision: number,
): StoredAnalysisRequest | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return null
    const record = parsed as Record<string, unknown>
    if (
      Object.keys(record).some(
        (key) =>
          !['journalId', 'journalRevision', 'requestKey', 'jobId'].includes(
            key,
          ),
      ) ||
      record.journalId !== journalId ||
      record.journalRevision !== revision ||
      typeof record.requestKey !== 'string' ||
      record.requestKey.length < 16 ||
      record.requestKey.length > 128 ||
      (record.jobId !== undefined && !isJournalId(record.jobId))
    )
      return null
    return record as StoredAnalysisRequest
  } catch {
    return null
  }
}

export function matchesDisplayedRevision(
  job: AnalysisJob,
  journalId: string,
  revision: number,
) {
  return job.journalId === journalId && job.journalRevision === revision
}

export const actionRoutes: Readonly<
  Partial<Record<SuggestedAction, { href: string; label: string }>>
> = {
  OFFER_RESOURCE_EXPLANATION: {
    href: '/resources',
    label: 'Xem tài nguyên đã được duyệt',
  },
  GUIDE_APPROVED_ACTIVITY: {
    href: '/support-guides',
    label: 'Mở hướng dẫn hỗ trợ',
  },
  REQUEST_ALLOWED_ALTERNATIVE: {
    href: '/support-plan',
    label: 'Xem lựa chọn trong kế hoạch',
  },
  REQUEST_PLAN_REVIEW: {
    href: '/support-plan',
    label: 'Xem lại kế hoạch hỗ trợ',
  },
  OPEN_PROFESSIONAL_SUPPORT: {
    href: '/safety-directory',
    label: 'Xem nguồn hỗ trợ chuyên môn',
  },
  OPEN_SAFETY_GUIDANCE: {
    href: '/safety-directory',
    label: 'Mở hướng dẫn an toàn',
  },
}

const consentReasons = new Set<AnalysisTerminalReason>([
  'CONSENT_REQUIRED',
  'CONSENT_REVOKED',
])

export const isConsentFailure = (reason: AnalysisTerminalReason | null) =>
  reason !== null && consentReasons.has(reason)

export const isStaleFailure = (reason: AnalysisTerminalReason | null) =>
  reason === 'REVISION_STALE' || reason === 'JOURNAL_DELETED'

export const canRetryAnalysis = (reason: AnalysisTerminalReason | null) =>
  reason !== null && !isConsentFailure(reason) && !isStaleFailure(reason)

export const isValidStoredRevision = isJournalRevision
