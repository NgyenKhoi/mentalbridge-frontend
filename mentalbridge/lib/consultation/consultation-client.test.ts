import { afterEach, describe, expect, it, vi } from 'vitest'

import { consultationClient } from './consultation-client'

vi.mock('@/lib/config/server', () => ({
  readConsultationServerConfig: () => ({
    baseUrl: 'http://consultation.test/',
    timeoutMs: 1_000,
  }),
}))

describe('Consultation server-only client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps a provider network failure to an explicit dependency failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(
      consultationClient.own('access-token', 'correlation-id'),
    ).rejects.toMatchObject({
      status: 503,
      code: 'CONSULTATION_UNAVAILABLE',
    })
  })

  it('preserves a provider concurrency conflict as a known outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            type: '/problems/conflict',
            title: 'Profile changed',
            status: 409,
            code: 'VERSION_CONFLICT',
            correlationId: 'provider-correlation',
          },
          { status: 409 },
        ),
      ),
    )

    await expect(
      consultationClient.submit('access-token', 'correlation-id', '"1"'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
      correlationId: 'provider-correlation',
    })
  })

  it('publishes availability through the typed provider boundary with auth and idempotency', async () => {
    const slot = {
      id: '1c12df8c-bdd7-4a14-9cd1-e9ce9d35d7f8',
      startAt: '2026-09-18T02:00:00Z',
      endAt: '2026-09-18T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT' as const,
      status: 'ACTIVE',
      readiness: 'AVAILABLE',
      withdrawnAt: null,
      createdAt: '2026-09-17T01:00:00Z',
      updatedAt: '2026-09-17T01:00:00Z',
      version: 0,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(slot, { status: 201, headers: { ETag: '"0"' } }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      consultationClient.publishAvailability(
        'access-token',
        'correlation-id',
        {
          startAt: slot.startAt,
          endAt: slot.endAt,
          timezone: slot.timezone,
          modality: slot.modality,
        },
        'availability-key-123456',
      ),
    ).resolves.toMatchObject({ data: slot, etag: '"0"' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(
      'http://consultation.test/api/v1/availability-slots',
    )
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'X-Correlation-Id': 'correlation-id',
      'Idempotency-Key': 'availability-key-123456',
    })
  })

  it('fails closed when an availability response is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ items: [], count: 1 })),
    )

    await expect(
      consultationClient.availability('access-token', 'correlation-id', ''),
    ).rejects.toMatchObject({
      status: 502,
      code: 'CONSULTATION_MALFORMED_RESPONSE',
    })
  })

  it('reads the authoritative credit balance with bearer and correlation headers', async () => {
    const account = {
      accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
      packageCode: 'FREE',
      source: 'DEFAULT_FREE',
      sourceReference: null,
      periodStart: null,
      periodEnd: null,
      policyVersion: 'consultation-credit-v2',
      balance: {
        available: 0,
        held: 0,
        consumed: 0,
        forfeited: 0,
        total: 0,
        releasedTransitions: 0,
      },
      reservationCapacity: {
        active: 0,
        maximum: 0,
        remaining: 0,
      },
      history: [],
      generatedAt: '2026-09-20T01:00:00Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(account))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      consultationClient.credits('access-token', 'correlation-id'),
    ).resolves.toMatchObject({ data: account })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://consultation.test/api/v1/service-credits')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'X-Correlation-Id': 'correlation-id',
    })
  })
})
