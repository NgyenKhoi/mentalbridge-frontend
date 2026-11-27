import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { journalClient } from './journal-client'

const baseUrl = 'http://journal.test'
const journalId = '40000000-0000-4000-8000-000000000001'
const clientEntryId = '50000000-0000-4000-8000-000000000001'
const timestamp = '2026-09-11T03:00:00.000Z'
const jobId = '70000000-0000-4000-8000-000000000001'
const entry = {
  id: journalId,
  ownerAccountId: '10000000-0000-4000-8000-000000000001',
  currentRevision: 1,
  occurredAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: false,
  tags: [],
  mood: 'GOOD' as const,
  encryption: {
    algorithm: 'AES-256-GCM' as const,
    keyId: 'test-v1',
    encryptedAt: timestamp,
  },
  analysisState: 'not_requested' as const,
  content: { text: 'synthetic journal', byteLength: 17 },
}
const createBody = {
  clientEntryId,
  occurredAt: timestamp,
  content: { text: 'synthetic journal' },
  mood: 'GOOD' as const,
  tags: [],
}
const runningJob = {
  jobId,
  journalId,
  journalRevision: 1,
  status: 'RUNNING' as const,
  attemptCount: 0,
  terminalReason: null,
  result: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null,
}
const longitudinalRequest = {
  previousPeriod: {
    startAt: '2026-08-27T00:00:00Z',
    endAt: '2026-09-10T00:00:00Z',
  },
  currentPeriod: {
    startAt: '2026-09-10T00:00:00Z',
    endAt: '2026-09-24T00:00:00Z',
  },
  excludedJournalIds: [],
}
const longitudinalJob = {
  jobId,
  previousPeriod: longitudinalRequest.previousPeriod,
  currentPeriod: longitudinalRequest.currentPeriod,
  sourceJournalRevisions: [],
  dataCoverage: {
    previousPeriodJournalEntryCount: 0,
    currentPeriodJournalEntryCount: 0,
    sufficientForComparison: false,
  },
  status: 'RUNNING' as const,
  attemptCount: 0,
  terminalReason: null,
  result: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null,
}

describe('Journal server-only client', () => {
  afterEach(() => vi.unstubAllEnvs())

  function configure(timeout = '5000') {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', baseUrl)
    vi.stubEnv('JOURNAL_AI_SERVICE_TIMEOUT_MS', timeout)
  }

  it('forwards credentials and concurrency headers only at the provider boundary', async () => {
    configure()
    mockServer.use(
      http.patch(`${baseUrl}/api/v1/journals/${journalId}`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer access-token')
        expect(request.headers.get('idempotency-key')).toBe(
          'revision-command-0001',
        )
        expect(request.headers.get('if-match-revision')).toBe('1')
        expect(request.headers.get('x-correlation-id')).toBe('correlation-id')
        return HttpResponse.json(entry)
      }),
    )

    await expect(
      journalClient.revise(
        'access-token',
        journalId,
        1,
        { content: { text: 'synthetic journal' }, tags: [] },
        'revision-command-0001',
        'correlation-id',
      ),
    ).resolves.toEqual(entry)
  })

  it('requests and reloads the exact owner-scoped analysis job', async () => {
    configure()
    mockServer.use(
      http.post(
        `${baseUrl}/api/v1/journals/${journalId}/revisions/1/analysis-jobs`,
        ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer access-token',
          )
          expect(request.headers.get('idempotency-key')).toBe(
            'analysis-command-0001',
          )
          return HttpResponse.json(runningJob, { status: 202 })
        },
      ),
      http.get(`${baseUrl}/api/v1/analysis-jobs/${jobId}`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer access-token')
        return HttpResponse.json({ ...runningJob, attemptCount: 1 })
      }),
    )

    await expect(
      journalClient.requestAnalysis(
        'access-token',
        journalId,
        1,
        'analysis-command-0001',
        'correlation-id',
      ),
    ).resolves.toEqual(runningJob)
    await expect(
      journalClient.analysisJob('access-token', jobId, 'correlation-id'),
    ).resolves.toMatchObject({ jobId, journalRevision: 1, attemptCount: 1 })
  })

  it('creates and reloads the authoritative longitudinal job', async () => {
    configure()
    mockServer.use(
      http.post(
        `${baseUrl}/api/v1/longitudinal-analysis-jobs`,
        async ({ request }) => {
          expect(request.headers.get('idempotency-key')).toBe(
            'longitudinal-command-0001',
          )
          expect(await request.json()).toEqual(longitudinalRequest)
          return HttpResponse.json(longitudinalJob, { status: 202 })
        },
      ),
      http.get(`${baseUrl}/api/v1/longitudinal-analysis-jobs/${jobId}`, () =>
        HttpResponse.json({ ...longitudinalJob, attemptCount: 1 }),
      ),
    )

    await expect(
      journalClient.createLongitudinalAnalysis(
        'access-token',
        longitudinalRequest,
        'longitudinal-command-0001',
        'correlation-id',
      ),
    ).resolves.toEqual(longitudinalJob)
    await expect(
      journalClient.longitudinalAnalysisJob(
        'access-token',
        jobId,
        'correlation-id',
      ),
    ).resolves.toMatchObject({ jobId, status: 'RUNNING', attemptCount: 1 })
  })

  it.each([
    [
      'create',
      () =>
        journalClient.create(
          'token',
          createBody,
          'create-command-0001',
          'correlation',
        ),
    ],
    [
      'revise',
      () =>
        journalClient.revise(
          'token',
          journalId,
          1,
          { content: { text: 'updated' } },
          'revise-command-0001',
          'correlation',
        ),
    ],
    [
      'delete',
      () =>
        journalClient.remove(
          'token',
          journalId,
          'delete-command-0001',
          'correlation',
        ),
    ],
  ])(
    'maps a malformed successful %s response to an unknown outcome',
    async (_name, invoke) => {
      configure()
      mockServer.use(
        http.post(`${baseUrl}/api/v1/journals`, () =>
          HttpResponse.json({ id: journalId }),
        ),
        http.patch(`${baseUrl}/api/v1/journals/${journalId}`, () =>
          HttpResponse.json({ id: journalId }),
        ),
        http.delete(`${baseUrl}/api/v1/journals/${journalId}`, () =>
          HttpResponse.json({ id: journalId }),
        ),
      )

      await expect(invoke()).rejects.toMatchObject({
        code: 'JOURNAL_MUTATION_OUTCOME_UNKNOWN',
        status: 503,
      })
    },
  )

  it('preserves a documented provider rejection as a known outcome', async () => {
    configure()
    mockServer.use(
      http.post(`${baseUrl}/api/v1/journals`, () =>
        HttpResponse.json(
          {
            type: '/problems/conflict',
            title: 'Conflict',
            status: 409,
            code: 'CONFLICT',
            correlationId: 'provider-correlation',
          },
          { status: 409 },
        ),
      ),
    )

    await expect(
      journalClient.create('token', createBody, 'create-command-0001', 'local'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
  })

  it('bounds malformed and oversized read responses', async () => {
    configure()
    mockServer.use(
      http.get(
        `${baseUrl}/api/v1/journals`,
        () =>
          new HttpResponse('{}', {
            headers: {
              'content-type': 'application/json',
              'content-length': String(128 * 1024 + 1),
            },
          }),
      ),
    )

    await expect(
      journalClient.list('token', undefined, 'correlation'),
    ).rejects.toMatchObject({ code: 'JOURNAL_MALFORMED_RESPONSE', status: 502 })
  })

  it('distinguishes a timed-out read from an ambiguous timed-out mutation', async () => {
    configure('100')
    mockServer.use(
      http.get(`${baseUrl}/api/v1/journals`, async () => {
        await delay(250)
        return HttpResponse.json({
          items: [],
          page: { limit: 20, hasMore: false },
        })
      }),
      http.post(`${baseUrl}/api/v1/journals`, async () => {
        await delay(250)
        return HttpResponse.json(entry)
      }),
    )

    await expect(
      journalClient.list('token', undefined, 'correlation'),
    ).rejects.toMatchObject({ code: 'JOURNAL_UNAVAILABLE', status: 503 })
    await expect(
      journalClient.create(
        'token',
        createBody,
        'create-command-0001',
        'correlation',
      ),
    ).rejects.toMatchObject({
      code: 'JOURNAL_MUTATION_OUTCOME_UNKNOWN',
      status: 503,
    })
  })
})
