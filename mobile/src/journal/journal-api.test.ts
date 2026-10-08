import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createJournalApi } from './journal-api'
import {
  analysisJobSchema,
  journalWriteSchema,
  trendJobSchema,
  trendRequestSchema,
} from './journal-contract'
import {
  completed,
  disclosure,
  entry,
  granted,
  page,
  running,
  subject,
  trend,
} from './journal-test-fixtures'
import { validateAnalysisTarget } from './use-journal-analysis'

function client(data: unknown, requests: InternalAxiosRequestConfig[] = []) {
  const adapter: AxiosAdapter = async (request) => {
    requests.push(request)
    return { config: request, data, headers: {}, status: 200, statusText: 'OK' }
  }
  return createJournalApi(create({ adapter }), subject)
}
const body = {
  content: { text: 'Một ngày bình yên.' },
  mood: 'GOOD' as const,
  tags: ['công việc'],
}

describe('Mobile Journal public contract', () => {
  it('creates only owner-neutral approved fields with a stable idempotency key', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const input = {
      ...body,
      clientEntryId: entry.id,
      occurredAt: entry.occurredAt,
    }
    await client(entry, requests).create(input, 'request-key-create')
    expect(requests[0]?.url).toBe('/api/v1/journals')
    expect(JSON.parse(requests[0]?.data as string)).toEqual(input)
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      'request-key-create',
    )
    expect(
      journalWriteSchema.safeParse({
        ...body,
        ownerAccountId: subject,
        sentiment: 'POSITIVE',
      }).success,
    ).toBe(false)
  })
  it('sends the loaded revision for PATCH and validates returned identity/revision', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    await client({ ...entry, currentRevision: 2 }, requests).revise(
      entry.id,
      1,
      body,
      'revision-request-key',
    )
    expect(requests[0]?.method).toBe('patch')
    expect(requests[0]?.headers.get('If-Match-Revision')).toBe('1')
    expect(JSON.parse(requests[0]?.data as string)).toEqual(body)
    await expect(
      client(entry).revise(entry.id, 1, body, 'revision-request-key'),
    ).rejects.toMatchObject({ code: 'JOURNAL_REVISION_MISMATCH' })
  })
  it('loads bounded owner pages and validates a deletion tombstone', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    await client(page(), requests).list('opaque-cursor')
    expect(requests[0]?.params).toEqual({ limit: 20, cursor: 'opaque-cursor' })
    expect(requests[0]?.headers.has('Idempotency-Key')).toBe(false)
    await client(
      {
        id: entry.id,
        ownerAccountId: subject,
        deleted: true,
        deletedAt: entry.updatedAt,
      },
      requests,
    ).remove(entry.id, 'delete-request-key')
    expect(requests[1]?.method).toBe('delete')
  })
  it('rejects cross-owner and cross-entry reads', async () => {
    await expect(
      client({ ...entry, ownerAccountId: running.jobId }).detail(entry.id),
    ).rejects.toMatchObject({ code: 'JOURNAL_OWNER_MISMATCH' })
    await expect(client(entry).detail(running.jobId)).rejects.toMatchObject({
      code: 'JOURNAL_IDENTITY_MISMATCH',
    })
    await expect(
      client(page([{ ...entry, ownerAccountId: running.jobId }])).list(),
    ).rejects.toMatchObject({ code: 'JOURNAL_OWNER_MISMATCH' })
  })
  it('uses Care public consent reads and a decision with no actor/entitlement payload', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    await client(disclosure, requests).disclosure()
    await client(granted, requests).authorization()
    expect(requests.map((value) => value.url)).toEqual([
      '/api/v1/ai-processing-disclosures/current',
      '/api/v1/consents/ai-processing/authorization',
    ])
    expect(requests[0]?.params).toEqual({ locale: 'vi-VN' })
    await client(
      {
        decisionId: entry.id,
        consentType: 'AI_PROCESSING',
        policyVersion: disclosure.version,
        granted: true,
        decidedAt: entry.createdAt,
      },
      requests,
    ).consent(disclosure.version, true, 'consent-request-key')
    expect(requests[2]?.url).toBe('/api/v1/consent-decisions')
    expect(JSON.parse(requests[2]?.data as string)).toEqual({
      consentType: 'AI_PROCESSING',
      policyVersion: disclosure.version,
      granted: true,
    })
  })
  it('requests exact-revision AI without text, actor, score, or consent claims in the body', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    await client(running, requests).requestAnalysis(
      entry.id,
      1,
      'analysis-request-key',
    )
    expect(requests[0]?.url).toBe(
      `/api/v1/journals/${entry.id}/revisions/1/analysis-jobs`,
    )
    expect(requests[0]?.data).toBeUndefined()
    await client(completed, requests).analysisJob(running.jobId)
    expect(requests[1]?.method).toBe('get')
    expect(requests[1]?.headers.has('Idempotency-Key')).toBe(false)
  })
  it('rejects invalid terminal states and mismatched exact-head provenance', () => {
    expect(
      analysisJobSchema.safeParse({ ...running, result: completed.result })
        .success,
    ).toBe(false)
    expect(
      analysisJobSchema.safeParse({ ...completed, completedAt: null }).success,
    ).toBe(false)
    expect(() =>
      validateAnalysisTarget(completed, {
        kind: 'EXACT',
        journalId: entry.id,
        revision: 2,
      }),
    ).toThrow('Analysis source mismatch.')
    expect(() =>
      validateAnalysisTarget(
        completed,
        { kind: 'EXACT', journalId: entry.id, revision: 1 },
        entry.id,
      ),
    ).toThrow()
  })
  it('keeps trend source and coverage authoritative and bounds windows', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const input = {
      previousPeriod: trend.previousPeriod,
      currentPeriod: trend.currentPeriod,
    }
    await client(trend, requests).requestTrend(input, 'comparison-request-key')
    expect(JSON.parse(requests[0]?.data as string)).toEqual(input)
    expect(
      trendJobSchema.safeParse({
        ...trend,
        result: { ...trend.result, sourceJournalRevisions: [] },
      }).success,
    ).toBe(false)
    expect(
      trendJobSchema.safeParse({
        ...trend,
        result: {
          ...trend.result,
          dataCoverage: {
            ...trend.dataCoverage,
            sufficientForComparison: true,
          },
        },
      }).success,
    ).toBe(false)
    expect(
      trendRequestSchema.safeParse({
        ...input,
        currentPeriod: trend.previousPeriod,
      }).success,
    ).toBe(false)
    expect(
      trendRequestSchema.safeParse({
        ...input,
        excludedJournalIds: [entry.id, entry.id],
      }).success,
    ).toBe(false)
  })
})
