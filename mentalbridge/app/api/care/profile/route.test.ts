import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  putProfile: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: {
    getProfile: careMocks.getProfile,
    putProfile: careMocks.putProfile,
  },
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { PUT } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/care/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
    },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/care/profile', () => {
  beforeEach(() => {
    careMocks.getProfile.mockReset()
    careMocks.putProfile.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
  })

  it('rejects an invalid birth date with a field violation before calling Care', async () => {
    const response = await PUT(
      request({ displayName: 'Nguyễn An', dateOfBirth: 'not-a-date' }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      violations: [{ field: 'dateOfBirth', code: 'INVALID_DATE' }],
    })
    expect(careMocks.putProfile).not.toHaveBeenCalled()
  })

  it('forwards only editable profile fields and relies on server defaults', async () => {
    careMocks.putProfile.mockResolvedValue({
      accountId: '10000000-0000-4000-8000-000000000009',
      displayName: 'Nguyễn An',
      dateOfBirth: null,
      gender: null,
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
      reminderEnabled: false,
      createdAt: '2026-09-09T00:00:00Z',
      updatedAt: '2026-09-09T00:00:00Z',
      version: 0,
    })

    const response = await PUT(
      request({ displayName: ' Nguyễn An ', dateOfBirth: null, gender: null }),
    )

    expect(response.status).toBe(201)
    expect(careMocks.putProfile).toHaveBeenCalledWith(
      'identity-access-secret',
      { displayName: 'Nguyễn An', dateOfBirth: null, gender: null },
      undefined,
      expect.any(String),
    )
  })

  it('preserves safe upstream field violations in Problem Details', async () => {
    careMocks.putProfile.mockRejectedValue(
      new ApiError({
        message: 'Request validation failed',
        code: 'VALIDATION_FAILED',
        status: 400,
        correlationId: '10000000-0000-4000-8000-000000000010',
        problem: {
          type: '/problems/validation-failed',
          title: 'Request validation failed',
          status: 400,
          code: 'VALIDATION_FAILED',
          correlationId: '10000000-0000-4000-8000-000000000010',
          violations: [{ field: 'dateOfBirth', code: 'MINIMUM_AGE_NOT_MET' }],
        },
      }),
    )

    const response = await PUT(
      request({ displayName: 'Nguyễn An', dateOfBirth: '2000-01-01' }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      violations: [{ field: 'dateOfBirth', code: 'MINIMUM_AGE_NOT_MET' }],
    })
  })
})
