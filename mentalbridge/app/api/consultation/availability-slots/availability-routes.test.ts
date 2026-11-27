import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  availability: vi.fn(),
  publishAvailability: vi.fn(),
  withdrawAvailability: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultationMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, POST } from './route'
import { DELETE } from './[slotId]/route'

const slotId = '1c12df8c-bdd7-4a14-9cd1-e9ce9d35d7f8'
const body = {
  startAt: '2026-09-18T02:00:00Z',
  endAt: '2026-09-18T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  modality: 'IN_APP_CHAT',
}
const slot = {
  id: slotId,
  ...body,
  status: 'ACTIVE',
  readiness: 'AVAILABLE',
  withdrawnAt: null,
  createdAt: '2026-09-17T01:00:00Z',
  updatedAt: '2026-09-17T01:00:00Z',
  version: 0,
}

function request(
  url = 'http://localhost/api/consultation/availability-slots',
  method = 'GET',
  requestBody?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(url, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...(requestBody === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
  })
}

describe('Consultation availability BFF', () => {
  beforeEach(() => {
    Object.values(consultationMocks).forEach((mock) => mock.mockReset())
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000001',
        status: 'ACTIVE',
        roles: ['SPECIALIST'],
        emailVerified: true,
      },
    })
    consultationMocks.availability.mockResolvedValue({
      data: {
        items: [slot],
        count: 1,
        generatedAt: '2026-09-17T01:00:00Z',
        videoPublishingEnabled: false,
      },
    })
    consultationMocks.publishAvailability.mockResolvedValue({
      data: slot,
      etag: '"0"',
    })
    consultationMocks.withdrawAvailability.mockResolvedValue({
      data: {
        ...slot,
        status: 'WITHDRAWN',
        readiness: 'WITHDRAWN',
        version: 1,
      },
      etag: '"1"',
    })
  })

  it('lists owner slots through an authenticated same-origin boundary', async () => {
    const response = await GET(
      request(
        'http://localhost/api/consultation/availability-slots?includeWithdrawn=true',
      ),
    )

    expect(response.status).toBe(200)
    expect(consultationMocks.availability).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      '?includeWithdrawn=true',
    )
    expect(JSON.stringify(await response.json())).not.toContain('access-token')
  })

  it('forwards only a validated exact-duration publish with idempotency', async () => {
    const response = await POST(
      request(undefined, 'POST', body, {
        'Idempotency-Key': 'availability-key-123456',
      }),
    )

    expect(response.status).toBe(201)
    expect(consultationMocks.publishAvailability).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      body,
      'availability-key-123456',
    )

    const invalid = await POST(
      request(
        undefined,
        'POST',
        { ...body, endAt: '2026-09-18T02:30:00Z' },
        { 'Idempotency-Key': 'availability-key-654321' },
      ),
    )
    expect(invalid.status).toBe(422)
    expect(consultationMocks.publishAvailability).toHaveBeenCalledTimes(1)
  })

  it('requires and forwards the current slot version when withdrawing', async () => {
    const context = { params: Promise.resolve({ slotId }) }
    const missing = await DELETE(
      request(
        `http://localhost/api/consultation/availability-slots/${slotId}`,
        'DELETE',
      ),
      context,
    )
    expect(missing.status).toBe(428)
    expect(consultationMocks.withdrawAvailability).not.toHaveBeenCalled()

    const response = await DELETE(
      request(
        `http://localhost/api/consultation/availability-slots/${slotId}`,
        'DELETE',
        undefined,
        { 'If-Match': '"0"' },
      ),
      context,
    )
    expect(response.status).toBe(200)
    expect(consultationMocks.withdrawAvailability).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      slotId,
      '"0"',
    )
  })
})
