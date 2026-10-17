// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockServer } from '@/tests/mocks/server'
import {
  emotionActionId,
  emotionCompletionFixture,
  emotionOccurrenceId,
  nativeSupportPlanFixture,
} from '@/features/support-plan/testing/native-support-plan-fixture'
import { supportPlanActionClient } from './support-plan-action-client'

describe('Care native action transport', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('checks a Journal candidate through the exact bounded owner path and rejects a swapped response', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    const journalId = '50000000-0000-4000-8000-000000000642'
    const result = {
      schemaVersion: 'journal-entry-occurrence-reconciliation-v1',
      occurrenceId: emotionOccurrenceId,
      actionId: emotionActionId,
      journalId,
      localDate: '2026-10-14',
      sourceState: 'MISSING',
      occurrenceState: 'SCHEDULED',
      version: 0,
      completedAt: null,
      completionEvidence: null,
    }
    let response = result
    mockServer.use(
      http.post(
        `http://care.test/api/v2/support-plan-occurrences/${emotionOccurrenceId}/journal/reconcile`,
        async ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer owner-token',
          )
          expect(request.headers.get('idempotency-key')).toBeNull()
          expect(await request.json()).toEqual({ journalId })
          return HttpResponse.json(response)
        },
      ),
    )
    expect(
      await supportPlanActionClient.reconcileJournal(
        'owner-token',
        emotionOccurrenceId,
        journalId,
        'correlation',
      ),
    ).toEqual(result)
    response = { ...result, journalId: emotionActionId }
    await expect(
      supportPlanActionClient.reconcileJournal(
        'owner-token',
        emotionOccurrenceId,
        journalId,
        'correlation',
      ),
    ).rejects.toMatchObject({ status: 502, code: 'CARE_MALFORMED_RESPONSE' })
  })
  it('does not transmit fact payload and accepts deleted source with retained completion', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    const result = {
      schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
      occurrenceId: emotionOccurrenceId,
      actionId: emotionActionId,
      localDate: '2026-10-13',
      sourceState: 'DELETED',
      occurrenceState: 'COMPLETED',
      version: 1,
      completedAt: '2026-10-13T13:01:00Z',
      completionEvidence: emotionCompletionFixture(),
    }
    mockServer.use(
      http.post(
        `http://care.test/api/v2/support-plan-occurrences/${emotionOccurrenceId}/emotion-check-in/reconcile`,
        async ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer owner-token',
          )
          expect(request.headers.get('if-match')).toBeNull()
          expect(request.headers.get('idempotency-key')).toBeNull()
          expect(await request.text()).toBe('')
          return HttpResponse.json(result)
        },
      ),
    )
    expect(
      await supportPlanActionClient.reconcile(
        'owner-token',
        emotionOccurrenceId,
        'correlation',
      ),
    ).toEqual(result)
  })
  it('rejects mismatched occurrence identity or false completion', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    mockServer.use(
      http.post(
        `http://care.test/api/v2/support-plan-occurrences/${emotionOccurrenceId}/emotion-check-in/reconcile`,
        () =>
          HttpResponse.json({
            schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
            occurrenceId: '90000000-0000-4000-8000-000000000641',
            actionId: emotionActionId,
            localDate: '2026-10-13',
            sourceState: 'MISSING',
            occurrenceState: 'SCHEDULED',
            version: 0,
            completedAt: null,
            completionEvidence: null,
          }),
      ),
    )
    await expect(
      supportPlanActionClient.reconcile(
        'owner-token',
        emotionOccurrenceId,
        'correlation',
      ),
    ).rejects.toMatchObject({ status: 502, code: 'CARE_MALFORMED_RESPONSE' })
  })
  it('posts explicit native proposal with stable retry identity, not a v1 conversion', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    const plan = {
      ...nativeSupportPlanFixture(),
      status: 'DRAFT',
      activatedAt: null,
    }
    mockServer.use(
      http.post(
        'http://care.test/api/v2/support-plans',
        async ({ request }) => {
          expect(request.headers.get('idempotency-key')).toBe(
            'native-proposal-retry-01',
          )
          expect(await request.json()).toEqual({
            sourceSupportEvaluationId: emotionActionId,
          })
          return HttpResponse.json(plan, { status: 201 })
        },
      ),
    )
    expect(
      await supportPlanActionClient.propose(
        'owner-token',
        { sourceSupportEvaluationId: emotionActionId },
        'native-proposal-retry-01',
        'correlation',
      ),
    ).toEqual(plan)
  })
})
