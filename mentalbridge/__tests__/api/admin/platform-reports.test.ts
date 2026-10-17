import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'

import { GET as catalogue } from '@/app/api/admin/platform-reports/catalogue/route'
import {
  GET as history,
  POST as createReport,
} from '@/app/api/admin/platform-reports/route'
import { POST as retryReport } from '@/app/api/admin/platform-reports/[reportId]/retries/route'
import { GET as downloadReport } from '@/app/api/admin/platform-reports/[reportId]/artifact/route'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const correlationId = '8fb5720a-53ab-40db-9cf4-f5cfabbdaf65'
const reportId = '94464b2b-a7fd-46fd-9310-64ef4eac7de7'

function account() {
  return {
    accountId: '82464b2b-a7fd-46fd-9310-64ef4eac7de7',
    email: 'admin@example.com',
    status: 'ACTIVE',
    roles: ['ADMIN'],
    emailVerified: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    version: 1,
  }
}

function report(status: 'QUEUED' | 'FAILED' | 'COMPLETED' = 'QUEUED') {
  return {
    reportId,
    reportType: 'ACCOUNT_ACTIVITY',
    scopeVersion: 'platform-account-activity-report-v1',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    requestedBy: account().accountId,
    requestedAt: '2026-10-01T00:00:00Z',
    status,
    sourceVersions: { identityAccounts: 'identity-account-projection-v1' },
    retryOf: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    failureCode: null,
    downloadable: status === 'COMPLETED',
    fileName: status === 'COMPLETED' ? 'report.json' : null,
    mediaType: status === 'COMPLETED' ? 'application/json' : null,
    contentLength: status === 'COMPLETED' ? 18 : null,
    contentSha256: status === 'COMPLETED' ? 'a'.repeat(64) : null,
    retainedUntil: status === 'COMPLETED' ? '2026-10-31T00:00:00Z' : null,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        status >= 400 ? 'application/problem+json' : 'application/json',
    },
  })
}

function request(
  path: string,
  options: {
    method?: string
    body?: unknown
    key?: string
    origin?: string
  } = {},
) {
  const headers = new Headers({
    Host: 'localhost',
    Origin: options.origin ?? 'http://localhost',
    'X-Correlation-Id': correlationId,
    Cookie: `${ACCESS_COOKIE_NAME}=admin-access-token`,
  })
  if (options.body !== undefined)
    headers.set('Content-Type', 'application/json')
  if (options.key) headers.set('Idempotency-Key', options.key)
  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  })
}

beforeEach(() => {
  vi.stubEnv('IDENTITY_API_BASE_URL', 'http://identity.test')
  vi.stubEnv('IDENTITY_API_TIMEOUT_MS', '1000')
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('platform report BFF', () => {
  it('serves authoritative catalogue and bounded history to ADMIN', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(
        json([
          {
            reportType: 'ACCOUNT_ACTIVITY',
            label: 'Account activity',
            description: 'Aggregate accounts',
            scopeVersion: 'platform-account-activity-report-v1',
            maximumPeriodDays: 366,
          },
        ]),
      )
    expect(
      (await catalogue(request('/api/admin/platform-reports/catalogue')))
        .status,
    ).toBe(200)

    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(json({ items: [report()], nextCursor: null }))
    const response = await history(
      request('/api/admin/platform-reports?limit=20'),
    )
    expect(response.status).toBe(200)
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toContain('limit=20')
  })

  it('validates same-origin request and forwards idempotency identity', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(json(report(), 202))
    const response = await createReport(
      request('/api/admin/platform-reports', {
        method: 'POST',
        key: 'platform-report-request-0001',
        body: {
          reportType: 'ACCOUNT_ACTIVITY',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
        },
      }),
    )
    expect(response.status).toBe(202)
    expect(
      new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get(
        'Idempotency-Key',
      ),
    ).toBe('platform-report-request-0001')

    const denied = await createReport(
      request('/api/admin/platform-reports', {
        method: 'POST',
        origin: 'https://attacker.example',
        key: 'platform-report-request-0002',
        body: {
          reportType: 'ACCOUNT_ACTIVITY',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
        },
      }),
    )
    expect(denied.status).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('forwards retry and streams only a bounded completed artifact', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(json(report('FAILED'), 202))
    const retry = await retryReport(
      request(`/api/admin/platform-reports/${reportId}/retries`, {
        method: 'POST',
        key: 'platform-report-retry-0001',
      }),
      { params: Promise.resolve({ reportId }) },
    )
    expect(retry.status).toBe(202)

    const artifact = new TextEncoder().encode('{"aggregate":{}}')
    const artifactSha256 = createHash('sha256').update(artifact).digest('hex')
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(
        new Response(artifact, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(artifact.byteLength),
            'Content-Disposition': 'attachment; filename="report.json"',
            'X-Content-SHA256': artifactSha256,
            'X-Retained-Until': '2026-10-31T00:00:00Z',
          },
        }),
      )
    const response = await downloadReport(
      request(`/api/admin/platform-reports/${reportId}/artifact`),
      {
        params: Promise.resolve({ reportId }),
      },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-SHA256')).toBe(artifactSha256)
    expect(await response.text()).toBe('{"aggregate":{}}')
  })

  it('rejects an artifact whose content does not match its immutable digest', async () => {
    const artifact = new TextEncoder().encode('{"aggregate":{"count":1}}')
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(
        new Response(artifact, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(artifact.byteLength),
            'X-Content-SHA256': 'a'.repeat(64),
            'X-Retained-Until': '2026-10-31T00:00:00Z',
          },
        }),
      )

    const response = await downloadReport(
      request(`/api/admin/platform-reports/${reportId}/artifact`),
      { params: Promise.resolve({ reportId }) },
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      code: 'IDENTITY_MALFORMED_RESPONSE',
    })
  })
})
