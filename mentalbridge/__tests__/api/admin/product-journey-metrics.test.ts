import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/admin/product-journey-metrics/route'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const correlationId = '8fb5720a-53ab-40db-9cf4-f5cfabbdaf65'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

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

function request(query: string) {
  return new NextRequest(
    `http://localhost/api/admin/product-journey-metrics?${query}`,
    {
      headers: {
        Host: 'localhost',
        'X-Correlation-Id': correlationId,
        Cookie: `${ACCESS_COOKIE_NAME}=admin-access-token`,
      },
    },
  )
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

describe('product journey metrics BFF', () => {
  it('rejects an invalid window before authentication', async () => {
    const response = await GET(request('from=nope&to=2026-10-09T08%3A00%3A00Z'))
    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires ADMIN and forwards only the explicit window', async () => {
    const body = {
      projectionVersion: 'product-journey-metrics-v1',
      window: { from: '2026-10-02T08:00:00Z', to: '2026-10-09T08:00:00Z' },
      asOf: '2026-10-09T08:00:00Z',
      interpretation: 'DESCRIPTIVE_PRODUCT_ACTIVITY_NOT_CLINICAL_EFFECTIVENESS',
      sources: [
        {
          source: 'IDENTITY',
          sourceVersion: 'identity-account-projection-v1',
          status: 'AVAILABLE',
          asOf: '2026-10-09T08:00:00Z',
          unavailableReason: null,
        },
        {
          source: 'CARE',
          sourceVersion: null,
          status: 'UNAVAILABLE',
          asOf: null,
          unavailableReason: 'DEPENDENCY_UNAVAILABLE',
        },
        {
          source: 'CONSULTATION',
          sourceVersion: null,
          status: 'UNAVAILABLE',
          asOf: null,
          unavailableReason: 'DEPENDENCY_UNAVAILABLE',
        },
      ],
      stages: [
        ...['REGISTERED_ACCOUNTS', 'ACTIVE_REGISTERED_ACCOUNTS'].map(
          (stage) => ({
            stage,
            source: 'IDENTITY',
            status: 'AVAILABLE',
            count: 0,
            rate: null,
            unavailableReason: null,
          }),
        ),
        ...[
          'COMPLETED_SCREENING_EPISODES',
          'SUPPORT_GUIDES_GENERATED',
          'SUPPORT_GUIDES_OPENED',
          'PAID_SUPPORT_PLANS_ACTIVATED',
        ].map((stage) => ({
          stage,
          source: 'CARE',
          status: 'UNAVAILABLE',
          count: null,
          rate: null,
          unavailableReason:
            stage === 'SUPPORT_GUIDES_OPENED'
              ? 'AUTHORITATIVE_USAGE_FACT_UNAVAILABLE'
              : 'SOURCE_UNAVAILABLE',
        })),
        ...[
          'CONSULTATIONS_REQUESTED',
          'CONSULTATIONS_CONFIRMED',
          'CONSULTATIONS_COMPLETED',
        ].map((stage) => ({
          stage,
          source: 'CONSULTATION',
          status: 'UNAVAILABLE',
          count: null,
          rate: null,
          unavailableReason: 'SOURCE_UNAVAILABLE',
        })),
      ],
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account()))
      .mockResolvedValueOnce(json(body))
    const response = await GET(
      request('from=2026-10-02T08%3A00%3A00Z&to=2026-10-09T08%3A00%3A00Z'),
    )
    expect(response.status).toBe(200)
    const url = String(vi.mocked(fetch).mock.calls[1][0])
    expect(url).toContain('/api/v1/admin/product-journey-metrics?')
    expect(url).toContain('from=2026-10-02T08%3A00%3A00Z')
    expect(url).not.toContain('score')
  })
})
