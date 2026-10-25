import { beforeEach, describe, expect, it, vi } from 'vitest'
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))
import {
  activateNativeSupportPlan,
  changeNativeActionOccurrenceState,
  confirmAdaptiveReviewOption,
  getAdaptiveSupportPlanReview,
  getSupportPlanActionOccurrences,
  getCurrentPlanResourceActions,
  proposeNativeSupportPlanDraft,
  reconcileEmotionCheckInOccurrence,
  reconcileJournalOccurrence,
  reconcileResourceOccurrence,
  reviewNativeSupportPlanReplacement,
  replaceWithNativeSupportPlan,
} from './browser-support-plan-actions'

describe('Native SupportPlan same-origin browser transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of Object.values(client))
      method.mockResolvedValue({ data: { version: 1 } })
  })
  it('reads the minimized resource projection and reconciles without client facts', async () => {
    const controller = new AbortController()
    await getCurrentPlanResourceActions('2026-10-21', controller.signal)
    expect(client.get).toHaveBeenCalledWith(
      '/care/v2/support-plans/current/resource-actions',
      { params: { localDate: '2026-10-21' }, signal: controller.signal },
    )
    await reconcileResourceOccurrence('occurrence-id', 3)
    expect(client.post).toHaveBeenCalledWith(
      '/care/v2/support-plan-occurrences/occurrence-id/resource/reconcile',
      undefined,
      { headers: { 'If-Match': '"3"' } },
    )
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
  it('reads the adaptive review without commands and confirms one option with retry identity', async () => {
    await getAdaptiveSupportPlanReview('plan-id')
    await getAdaptiveSupportPlanReview('plan-id', 'summary-id')
    const body = {
      reviewFingerprint: '3f2a9c4d7e1b6a5f8c0d2e4f6a8b0c1d',
      optionId: 'keep-current-1',
    }
    await confirmAdaptiveReviewOption('plan-id', 3, body, 'review-retry-key')
    expect(client.get).toHaveBeenNthCalledWith(
      1,
      '/care/v2/support-plans/plan-id/adaptive-review',
      {},
    )
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      '/care/v2/support-plans/plan-id/adaptive-review',
      { params: { reassessmentSummaryId: 'summary-id' } },
    )
    expect(client.post).toHaveBeenCalledWith(
      '/care/v2/support-plans/plan-id/adaptive-review/confirm',
      body,
      {
        headers: { 'If-Match': '"3"', 'Idempotency-Key': 'review-retry-key' },
      },
    )
  })
})
