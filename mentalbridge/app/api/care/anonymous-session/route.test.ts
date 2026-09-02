import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANONYMOUS_SESSION_ID_COOKIE,
  ANONYMOUS_SESSION_TOKEN_COOKIE,
} from '@/lib/care/assessment-cookies'

const careMocks = vi.hoisted(() => ({
  createAnonymousSession: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: { createAnonymousSession: careMocks.createAnonymousSession },
}))

import { POST } from './route'

describe('POST /api/care/anonymous-session', () => {
  beforeEach(() => careMocks.createAnonymousSession.mockReset())

  it('stores the bearer credential only in protected cookies', async () => {
    const sessionToken = `anonymous-${'s'.repeat(43)}`
    careMocks.createAnonymousSession.mockResolvedValue({
      sessionId: '10000000-0000-4000-8000-000000000001',
      sessionToken,
      expiresAt: '2099-01-01T00:30:00Z',
    })

    const response = await POST(
      new NextRequest('http://localhost/api/care/anonymous-session', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toEqual({ expiresAt: '2099-01-01T00:30:00Z' })
    const cookies = response.headers.get('set-cookie') ?? ''
    expect(cookies).toContain(`${ANONYMOUS_SESSION_ID_COOKIE}=`)
    expect(cookies).toContain(`${ANONYMOUS_SESSION_TOKEN_COOKIE}=`)
    expect(cookies).toContain('HttpOnly')
    expect(JSON.stringify(body).includes(sessionToken)).toBe(false)
  })
})
