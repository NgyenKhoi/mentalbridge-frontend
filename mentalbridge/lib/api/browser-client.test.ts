import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'

import { browserApiClient } from './browser-client'

describe('browserApiClient', () => {
  it('normalizes Identity Problem Details and preserves extensions', async () => {
    mockServer.use(
      http.get('http://localhost/api/identity/session', () =>
        HttpResponse.json(
          {
            type: 'https://mentalbridge.example/problems/invalid-session',
            title: 'Invalid session',
            status: 401,
            detail: 'The session is no longer valid.',
            code: 'INVALID_SESSION',
            correlationId: '0d405566-f909-4494-881d-70b3b05c3a7f',
            violations: [{ field: 'session', code: 'EXPIRED' }],
            retryable: false,
          },
          { status: 401 },
        ),
      ),
    )

    const request = browserApiClient.get('/identity/session')

    await expect(request).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_SESSION',
      status: 401,
      correlationId: '0d405566-f909-4494-881d-70b3b05c3a7f',
      problem: expect.objectContaining({ retryable: false }),
    })
  })

  it('maps an undocumented HTTP payload to a stable fallback error', async () => {
    mockServer.use(
      http.get('http://localhost/api/identity/session', () =>
        HttpResponse.json({ message: 'upstream failed' }, { status: 502 }),
      ),
    )

    await expect(
      browserApiClient.get('/identity/session'),
    ).rejects.toMatchObject({
      code: 'HTTP_502',
      status: 502,
      problem: undefined,
    })
  })
})
