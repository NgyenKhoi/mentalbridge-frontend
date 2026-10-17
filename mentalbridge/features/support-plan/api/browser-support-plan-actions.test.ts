import { beforeEach, describe, expect, it, vi } from 'vitest'
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))
import {
  activateNativeSupportPlan,
  changeNativeActionOccurrenceState,
  getSupportPlanActionOccurrences,
  proposeNativeSupportPlanDraft,
  reconcileEmotionCheckInOccurrence,
  reconcileJournalOccurrence,
  reviewNativeSupportPlanReplacement,
  replaceWithNativeSupportPlan,
} from './browser-support-plan-actions'

describe('Native SupportPlan same-origin browser transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of Object.values(client))
      method.mockResolvedValue({ data: { version: 1 } })
  })
  it('sends only a Journal candidate ID for owner verification, never private content or a fact assertion', async () => {
    await reconcileJournalOccurrence('occurrence-id', 'journal-id')
    expect(client.post).toHaveBeenCalledWith(
      '/care/v2/support-plan-occurrences/occurrence-id/journal/reconcile',
      { journalId: 'journal-id' },
    )
  })
  it('sends only explicit proposal/activation authority and same-origin paths', async () => {
    await proposeNativeSupportPlanDraft('evaluation-id', 'proposal-retry-key')
    await activateNativeSupportPlan('plan-id', 2, 'activation-retry-key')
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/care/v2/support-plans',
      { sourceSupportEvaluationId: 'evaluation-id' },
      { headers: { 'Idempotency-Key': 'proposal-retry-key' } },
    )
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/care/v2/support-plans/plan-id/activate',
      undefined,
      {
        headers: {
          'If-Match': '"2"',
          'Idempotency-Key': 'activation-retry-key',
        },
      },
    )
  })
  it('reconciles without client fact, date, token or synthetic retry key', async () => {
    await reconcileEmotionCheckInOccurrence('occurrence-id')
    expect(client.post).toHaveBeenCalledWith(
      '/care/v2/support-plan-occurrences/occurrence-id/emotion-check-in/reconcile',
    )
    await getSupportPlanActionOccurrences('2026-10-13', '2026-10-19')
    expect(client.get).toHaveBeenCalledWith(
      '/care/v2/support-plan-occurrences',
      { params: { from: '2026-10-13', through: '2026-10-19' } },
    )
    await changeNativeActionOccurrenceState('occurrence-id', 1, 'SKIPPED')
    expect(client.put).toHaveBeenCalledWith(
      '/care/v2/support-plan-occurrences/occurrence-id/state',
      { state: 'SKIPPED' },
      { headers: { 'If-Match': '"1"' } },
    )
  })
  it('keeps review read-only and retry identity only on explicit replacement', async () => {
    const request = {
      currentSupportPlanId: 'current-id',
      currentVersion: 2,
      reassessmentSummaryId: 'summary-id',
    }
    await reviewNativeSupportPlanReplacement('draft-id', 1, request)
    await replaceWithNativeSupportPlan(
      'draft-id',
      1,
      request,
      'replacement-retry-key',
    )
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/care/v2/support-plans/draft-id/replacement-review',
      request,
      { headers: { 'If-Match': '"1"' } },
    )
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/care/v2/support-plans/draft-id/replace',
      request,
      {
        headers: {
          'If-Match': '"1"',
          'Idempotency-Key': 'replacement-retry-key',
        },
      },
    )
  })
})
