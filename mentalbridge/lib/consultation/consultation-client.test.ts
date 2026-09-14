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
})
