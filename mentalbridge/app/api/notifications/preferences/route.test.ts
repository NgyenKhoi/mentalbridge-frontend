import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentServiceError } from '@/lib/content/content-client'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const contentMocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentPreferenceClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, PATCH } from './route'

const preferences = {
  notificationsEnabled: true,
  channels: { inApp: true, email: false, push: false },
  contentGroups: {
    journalReminder: true,
    emotionCheckIn: true,
    streakMilestone: true,
    screeningReassessment: true,
    appointmentMessage: true,
    resourceSystem: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  email: {
    cadence: 'IMMEDIATE' as const,
    wellbeingDigestEnabled: false,
    resourceRemindersEnabled: false,
  },
  version: 0,
  updatedAt: '2026-09-26T00:00:00.000Z',
}

function request(method: 'GET' | 'PATCH', body?: unknown, ifMatch?: string) {
  return new NextRequest('http://localhost/api/notifications/preferences', {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(ifMatch ? { 'If-Match': ifMatch } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('/api/notifications/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('loads owner preferences and preserves the upstream ETag', async () => {
    contentMocks.get.mockResolvedValue({ preferences, etag: '"0"' })
    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"0"')
    expect(await response.json()).toEqual(preferences)
    expect(contentMocks.get).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.any(Object), [
      'USER',
    ])
  })

  it('forwards an exact partial update and optimistic version', async () => {
    const patch = {
      channels: { email: true, push: true },
      quietHours: { timeZone: 'Europe/Paris' },
    }
    contentMocks.update.mockResolvedValue({
      preferences: { ...preferences, version: 1 },
      etag: '"1"',
    })

    const response = await PATCH(request('PATCH', patch, '"0"'))

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(contentMocks.update).toHaveBeenCalledWith(
      'identity-access-secret',
      patch,
      '"0"',
      expect.any(String),
    )
  })

  it.each([
    [{ channels: { sms: true } }, '"0"'],
    [{ quietHours: { start: '25:00' } }, '"0"'],
    [{ channels: { email: true } }, undefined],
  ])(
    'rejects invalid input before Content is called',
    async (body, ifMatch) => {
      const response = await PATCH(request('PATCH', body, ifMatch))
      expect(response.status).toBe(400)
      expect(contentMocks.update).not.toHaveBeenCalled()
    },
  )

  it('preserves a safe stale-version response', async () => {
    contentMocks.update.mockRejectedValue(
      new ContentServiceError({
        type: 'https://mentalbridge.io/errors/NOTIFICATION_PREFERENCE_VERSION_MISMATCH',
        title: 'Preferences changed elsewhere',
        status: 412,
        code: 'NOTIFICATION_PREFERENCE_VERSION_MISMATCH',
      }),
    )
    const response = await PATCH(
      request('PATCH', { channels: { email: true } }, '"0"'),
    )
    expect(response.status).toBe(412)
    expect((await response.json()).code).toBe(
      'NOTIFICATION_PREFERENCE_VERSION_MISMATCH',
    )
  })

  it('returns a bounded dependency failure', async () => {
    contentMocks.get.mockRejectedValue(new Error('private upstream details'))
    const response = await GET(request('GET'))
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain(
      'private upstream details',
    )
  })
})
