import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { ApiError } from '@/lib/api/api-error'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '@/features/support-plan/testing/native-support-plan-fixture'

const client = vi.hoisted(() => ({
  current: vi.fn(),
  draft: vi.fn(),
  detail: vi.fn(),
  history: vi.fn(),
  propose: vi.fn(),
  activate: vi.fn(),
  status: vi.fn(),
  review: vi.fn(),
  replace: vi.fn(),
  occurrences: vi.fn(),
  occurrenceState: vi.fn(),
  reconcile: vi.fn(),
  companionExplanation: vi.fn(),
  reconcileJournal: vi.fn(),
  continueCycle: vi.fn(),
  occurrenceEngagement: vi.fn(),
}))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/care/support-plan-action-client', () => ({
  supportPlanActionClient: client,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class extends Error {},
  ...session,
}))
import { supportPlanActionHandler } from '@/lib/care/support-plan-action-handlers'

const id = '10000000-0000-4000-8000-000000000641'
const key = 'native-command-retry-0001'
function request(
  method = 'POST',
  body?: unknown,
  headers: Record<string, string> = {},
  query = '',
) {
  return new NextRequest(`http://localhost/api/care/v2/support-plans${query}`, {
    method,
    headers: {
      origin: 'http://localhost',
      cookie: `${ACCESS_COOKIE_NAME}=server-token-only`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('Native SupportPlan bounded BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.resolveSession.mockResolvedValue({
      account: { accountId: id, roles: ['USER'] },
    })
    session.ensureRole.mockImplementation(() => undefined)
    for (const method of Object.values(client))
      method.mockResolvedValue(nativeSupportPlanFixture())
  })
  it('forwards exactly one Journal candidate using the authoritative USER session', async () => {
    client.reconcileJournal.mockResolvedValue({
      version: 1,
      sourceState: 'RECORDED',
      occurrenceState: 'COMPLETED',
    })
    const response = await supportPlanActionHandler(
      request('POST', { journalId: id }),
      'reconcileJournal',
      id,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('etag')).toBe('"1"')
    expect(await response.text()).not.toContain('server-token-only')
    expect(client.reconcileJournal).toHaveBeenCalledWith(
      'server-token-only',
      id,
      id,
      expect.any(String),
    )
  })
  it('rejects Journal private content, caller facts and malformed candidate IDs before the owner call', async () => {
    for (const body of [
      {},
      { journalId: null },
      { journalId: 'invalid' },
      { journalId: [id] },
      { journalId: id, text: 'private reflection' },
      { journalId: id, accountId: id },
      { journalId: id, factId: id },
    ]) {
      const response = await supportPlanActionHandler(
        request('POST', body),
        'reconcileJournal',
        id,
      )
      expect(response.status).toBe(400)
    }
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { journalId: id }),
          'reconcileJournal',
          'invalid',
        )
      ).status,
    ).toBe(400)
    expect(client.reconcileJournal).not.toHaveBeenCalled()
  })
  it('blocks foreign-origin and non-USER Journal checks', async () => {
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { journalId: id }, { origin: 'https://other.test' }),
          'reconcileJournal',
          id,
        )
      ).status,
    ).toBe(403)
    session.ensureRole.mockImplementationOnce(() => {
      throw new ApiError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'Forbidden',
      })
    })
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { journalId: id }),
          'reconcileJournal',
          id,
        )
      ).status,
    ).toBe(403)
    expect(client.reconcileJournal).not.toHaveBeenCalled()
  })
  it('uses authoritative USER access with no token in data, no-store and strong version', async () => {
    const response = await supportPlanActionHandler(request('GET'), 'current')
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).not.toContain('server-token-only')
    expect(session.ensureRole).toHaveBeenCalledWith(expect.anything(), ['USER'])
    expect(client.current).toHaveBeenCalledWith(
      'server-token-only',
      expect.any(String),
    )
  })
  it('does not proxy forbidden roles or cross-origin commands', async () => {
    session.ensureRole.mockImplementationOnce(() => {
      throw new ApiError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'Forbidden',
      })
    })
    expect(
      (await supportPlanActionHandler(request(), 'reconcile', id)).status,
    ).toBe(403)
    expect(
      (
        await supportPlanActionHandler(
          request('POST', undefined, { origin: 'https://other.test' }),
          'reconcile',
          id,
        )
      ).status,
    ).toBe(403)
    expect(client.reconcile).not.toHaveBeenCalled()
  })
  it('proposes only exact screening identity with retry key and never client facts', async () => {
    const response = await supportPlanActionHandler(
      request(
        'POST',
        { sourceSupportEvaluationId: id },
        { 'idempotency-key': key },
      ),
      'propose',
    )
    expect(response.status).toBe(201)
    expect(client.propose).toHaveBeenCalledWith(
      'server-token-only',
      { sourceSupportEvaluationId: id },
      key,
      expect.any(String),
    )
    const injected = await supportPlanActionHandler(
      request(
        'POST',
        { sourceSupportEvaluationId: id, accountId: id },
        { 'idempotency-key': key },
      ),
      'propose',
    )
    expect(injected.status).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { sourceSupportEvaluationId: id }),
          'propose',
        )
      ).status,
    ).toBe(400)
  })
  it('rejects oversize commands and invalid JSON without owner mutation', async () => {
    expect(
      (
        await supportPlanActionHandler(
          request(
            'POST',
            { sourceSupportEvaluationId: 'x'.repeat(1100) },
            { 'idempotency-key': key },
          ),
          'propose',
        )
      ).status,
    ).toBe(413)
    const invalid = new NextRequest(
      'http://localhost/api/care/v2/support-plans',
      {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          cookie: `${ACCESS_COOKIE_NAME}=server-token-only`,
          'idempotency-key': key,
          'content-type': 'application/json',
        },
        body: '{',
      },
    )
    expect((await supportPlanActionHandler(invalid, 'propose')).status).toBe(
      400,
    )
    expect(client.propose).not.toHaveBeenCalled()
  })
  it('requires exact strong If-Match for activation and forwards no body', async () => {
    expect(
      (
        await supportPlanActionHandler(
          request('POST', undefined, {
            'if-match': 'W/"1"',
            'idempotency-key': key,
          }),
          'activate',
          id,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('POST', undefined, {
            'if-match': '"1"',
            'idempotency-key': key,
          }),
          'activate',
          id,
        )
      ).status,
    ).toBe(200)
    expect(client.activate).toHaveBeenCalledWith(
      'server-token-only',
      id,
      1,
      key,
      expect.any(String),
    )
  })
  it('reconciles one occurrence without a caller fact, date or command key', async () => {
    client.reconcile.mockResolvedValue({
      version: 1,
      sourceState: 'DELETED',
      occurrenceState: 'COMPLETED',
    })
    expect(
      (await supportPlanActionHandler(request(), 'reconcile', id)).status,
    ).toBe(200)
    expect(client.reconcile).toHaveBeenCalledWith(
      'server-token-only',
      id,
      expect.any(String),
    )
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { factId: id }),
          'reconcile',
          id,
        )
      ).status,
    ).toBe(400)
    expect(
      (await supportPlanActionHandler(request(), 'reconcile', 'bad-id')).status,
    ).toBe(400)
  })
  it('forwards only exact plan/action identity and an approved contextual surface', async () => {
    const actionId = '20000000-0000-4000-8000-000000000650'
    client.companionExplanation.mockResolvedValue({
      supportPlanId: id,
      actionId,
      surface: 'PLAN',
    })
    const response = await supportPlanActionHandler(
      request('POST', { surface: 'PLAN' }),
      'companionExplanation',
      id,
      actionId,
    )
    expect(response.status).toBe(200)
    expect(client.companionExplanation).toHaveBeenCalledWith(
      'server-token-only',
      id,
      actionId,
      'PLAN',
      expect.any(String),
    )
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { surface: 'PLAN', context: { private: true } }),
          'companionExplanation',
          id,
          actionId,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('POST', { surface: 'PROGRESS' }),
          'companionExplanation',
          id,
          actionId,
        )
      ).status,
    ).toBe(400)
  })
  it('rejects a chunked body after its first chunk instead of reading an unbounded command', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([123]))
      },
      cancel,
    })
    const streaming = new NextRequest(
      'http://localhost/api/care/v2/support-plans',
      {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          cookie: `${ACCESS_COOKIE_NAME}=server-token-only`,
        },
        body,
      },
    )
    const response = await supportPlanActionHandler(streaming, 'reconcile', id)
    expect(response.status).toBe(400)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(client.reconcile).not.toHaveBeenCalled()
  })

  it('preserves 503 uncertainty and 412 conflict, sanitized, without automatic retry', async () => {
    client.reconcile.mockRejectedValue(
      new ApiError({
        code: 'EMOTION_CHECK_IN_EVIDENCE_UNAVAILABLE',
        status: 503,
        message: 'Bearer private-owner-token',
      }),
    )
    const unavailable = await supportPlanActionHandler(
      request(),
      'reconcile',
      id,
    )
    expect(unavailable.status).toBe(503)
    expect(await unavailable.text()).not.toContain('private-owner-token')
    expect(client.reconcile).toHaveBeenCalledTimes(1)
    client.occurrenceState.mockRejectedValue(
      new ApiError({
        code: 'SUPPORT_PLAN_OCCURRENCE_VERSION_MISMATCH',
        status: 412,
        message: 'Stale',
      }),
    )
    expect(
      (
        await supportPlanActionHandler(
          request('PUT', { state: 'SKIPPED' }, { 'if-match': '"0"' }),
          'occurrenceState',
          id,
        )
      ).status,
    ).toBe(412)
  })
  it('validates native state and real bounded local-date reads', async () => {
    client.occurrenceState.mockResolvedValue(emotionOccurrenceFixture())
    expect(
      (
        await supportPlanActionHandler(
          request('PUT', { state: 'SCHEDULED' }, { 'if-match': '"0"' }),
          'occurrenceState',
          id,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await supportPlanActionHandler(
          request(
            'PUT',
            { state: 'COMPLETED', rawEmotion: 5 },
            { 'if-match': '"0"' },
          ),
          'occurrenceState',
          id,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('GET', undefined, {}, '?from=2026-02-30&through=2026-03-01'),
          'occurrences',
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('GET', undefined, {}, '?from=2026-10-01&through=2026-11-01'),
          'occurrences',
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('GET', undefined, {}, '?from=2026-10-13&through=2026-10-19'),
          'occurrences',
        )
      ).status,
    ).toBe(200)
    expect(client.occurrences).toHaveBeenCalledWith(
      'server-token-only',
      '2026-10-13',
      '2026-10-19',
      expect.any(String),
    )
  })
  it('passes exact governed replacement validators and blocks injected fields', async () => {
    const body = {
      currentSupportPlanId: id,
      currentVersion: 2,
      reassessmentSummaryId: id,
    }
    expect(
      (
        await supportPlanActionHandler(
          request('POST', body, { 'if-match': '"1"' }),
          'review',
          id,
        )
      ).status,
    ).toBe(200)
    expect(client.review).toHaveBeenCalledWith(
      'server-token-only',
      id,
      1,
      body,
      expect.any(String),
    )
    expect(
      (
        await supportPlanActionHandler(
          request(
            'POST',
            { ...body, force: true },
            { 'if-match': '"1"', 'idempotency-key': key },
          ),
          'replace',
          id,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('POST', body, { 'if-match': '"1"', 'idempotency-key': key }),
          'replace',
          id,
        )
      ).status,
    ).toBe(200)
  })
  it('continues a review-due cycle only with strong If-Match, a retry key and no body', async () => {
    const headers = { 'if-match': '"3"', 'idempotency-key': key }
    expect(
      (
        await supportPlanActionHandler(
          request('POST', undefined, headers),
          'continueCycle',
          id,
        )
      ).status,
    ).toBe(200)
    expect(client.continueCycle).toHaveBeenCalledWith(
      'server-token-only',
      id,
      3,
      key,
      expect.any(String),
    )
    for (const [body, extra] of [
      [undefined, { 'if-match': '"3"' }],
      [undefined, { 'idempotency-key': key }],
      [{ cycleNumber: 9 }, headers],
    ] as const) {
      expect(
        (
          await supportPlanActionHandler(
            request('POST', body, extra),
            'continueCycle',
            id,
          )
        ).status,
      ).toBe(400)
    }
    expect(client.continueCycle).toHaveBeenCalledTimes(1)
  })
  it('records native helpfulness only through the bounded engagement shape', async () => {
    client.occurrenceEngagement.mockResolvedValue(emotionOccurrenceFixture())
    const body = {
      state: 'COMPLETED',
      hidden: false,
      helpfulness: 'HELPFUL',
      barrierCode: null,
      reflection: null,
      summaryReuseApproved: false,
    }
    expect(
      (
        await supportPlanActionHandler(
          request('PUT', body, { 'if-match': '"1"' }),
          'occurrenceEngagement',
          id,
        )
      ).status,
    ).toBe(200)
    expect(client.occurrenceEngagement).toHaveBeenCalledWith(
      'server-token-only',
      id,
      1,
      body,
      expect.any(String),
    )
    for (const invalid of [
      { ...body, helpfulness: 'AMAZING' },
      { ...body, completionEvidence: { factId: id } },
      { ...body, state: 'SKIPPED' },
      { ...body, state: ['SCHEDULED'], helpfulness: null },
      { ...body, helpfulness: ['HELPFUL'] },
    ]) {
      expect(
        (
          await supportPlanActionHandler(
            request('PUT', invalid, { 'if-match': '"1"' }),
            'occurrenceEngagement',
            id,
          )
        ).status,
      ).toBe(400)
    }
    expect(client.occurrenceEngagement).toHaveBeenCalledTimes(1)
  })
  it('validates lifecycle reason and cursor bounds', async () => {
    expect(
      (
        await supportPlanActionHandler(
          request(
            'PUT',
            { status: 'PAUSED', completionReason: 'OTHER' },
            { 'if-match': '"1"' },
          ),
          'status',
          id,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request(
            'PUT',
            { status: 'COMPLETED', completionReason: 'OTHER' },
            { 'if-match': '"1"' },
          ),
          'status',
          id,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await supportPlanActionHandler(
          request('GET', undefined, {}, '?limit=21'),
          'history',
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await supportPlanActionHandler(
          request('GET', undefined, {}, '?limit=10&cursor=old-page'),
          'history',
        )
      ).status,
    ).toBe(200)
  })
})
