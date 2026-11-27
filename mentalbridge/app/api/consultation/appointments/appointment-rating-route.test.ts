import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  appointmentRating: vi.fn(),
  saveAppointmentRating: vi.fn(),
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

import { GET, PUT } from './[appointmentId]/rating/route'

const appointmentId = '10a7e5d8-7960-42fb-9706-e642f849b78f'
const rating = {
  appointmentId,
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  rating: 4,
  createdAt: '2099-09-27T04:00:00Z',
  updatedAt: '2099-09-27T04:00:00Z',
  version: 2,
  specialistAggregate: { averageRating: 4.25, ratingCount: 8 },
}

function request(method: 'GET' | 'PUT', body?: unknown, etag?: string) {
  return new NextRequest(
    `http://localhost/api/consultation/appointments/${appointmentId}/rating`,
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=access-token`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(etag ? { 'If-Match': etag } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  )
}

const context = { params: Promise.resolve({ appointmentId }) }

describe('Appointment rating BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      accessToken: 'access-token',
      account: {
        accountId: 'user-id',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    consultationMocks.appointmentRating.mockResolvedValue({
      data: rating,
      etag: '"2"',
    })
    consultationMocks.saveAppointmentRating.mockResolvedValue({
      data: rating,
      etag: '"2"',
    })
  })

  it('reads the owner rating and preserves its ETag', async () => {
    const response = await GET(request('GET'), context)
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"2"')
    expect(consultationMocks.appointmentRating).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      appointmentId,
    )
  })

  it('forwards bounded edit value with the exact current version', async () => {
    const response = await PUT(request('PUT', { rating: 4 }, '"2"'), context)
    expect(response.status).toBe(200)
    expect(consultationMocks.saveAppointmentRating).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      appointmentId,
      4,
      '"2"',
    )
  })

  it('rejects an out-of-range rating before the provider call', async () => {
    const response = await PUT(request('PUT', { rating: 6 }), context)
    expect(response.status).toBe(400)
    expect(consultationMocks.saveAppointmentRating).not.toHaveBeenCalled()
  })
})
