import { describe, expect, it } from 'vitest'

import {
  actionRoutes,
  canRetryAnalysis,
  matchesDisplayedRevision,
  parseStoredAnalysisRequest,
} from './reflection'

const journalId = '40000000-0000-4000-8000-000000000001'
const jobId = '50000000-0000-4000-8000-000000000001'

describe('Journal reflection state mapping', () => {
  it('restores only the exact stored journal revision without journal content', () => {
    const stored = JSON.stringify({
      journalId,
      journalRevision: 2,
      requestKey: 'analysis-command-0001',
      jobId,
    })

    expect(parseStoredAnalysisRequest(stored, journalId, 2)).toEqual({
      journalId,
      journalRevision: 2,
      requestKey: 'analysis-command-0001',
      jobId,
    })
    expect(parseStoredAnalysisRequest(stored, journalId, 3)).toBeNull()
    expect(
      parseStoredAnalysisRequest(
        JSON.stringify({ ...JSON.parse(stored), journalText: 'private' }),
        journalId,
        2,
      ),
    ).toBeNull()
  })

  it('fails closed when a returned job belongs to another revision', () => {
    const job = {
      jobId,
      journalId,
      journalRevision: 2,
    } as Parameters<typeof matchesDisplayedRevision>[0]
    expect(matchesDisplayedRevision(job, journalId, 2)).toBe(true)
    expect(matchesDisplayedRevision(job, journalId, 3)).toBe(false)
  })

  it('routes only contract allow-listed governed actions', () => {
    expect(actionRoutes.NONE).toBeUndefined()
    expect(actionRoutes.GUIDE_APPROVED_ACTIVITY).toEqual({
      href: '/support-guides',
      label: 'Mở hướng dẫn hỗ trợ',
    })
    expect(actionRoutes.OPEN_SAFETY_GUIDANCE?.href).toBe('/safety-directory')
    expect(Object.keys(actionRoutes)).toHaveLength(6)
  })

  it('allows manual retry only for recoverable non-consent, non-stale failures', () => {
    expect(canRetryAnalysis('PROVIDER_TIMEOUT')).toBe(true)
    expect(canRetryAnalysis('CONSENT_REVOKED')).toBe(false)
    expect(canRetryAnalysis('REVISION_STALE')).toBe(false)
  })
})
