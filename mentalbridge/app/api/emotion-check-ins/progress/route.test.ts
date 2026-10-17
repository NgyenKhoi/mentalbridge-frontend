import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({ progress: vi.fn() }))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/emotion-check-in/client', () => ({
  emotionCheckInClient: client,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: session.resolveSession,
  ensureRole: session.ensureRole,
}))

import { GET } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}

const request = (query: string) =>
  new NextRequest(`http://localhost/api/emotion-check-ins/progress?${query}`, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
  })

describe('/api/emotion-check-ins/progress Route Handler', () => {
  beforeEach(() => {
    client.progress.mockReset()
    session.resolveSession.mockReset()
    session.ensureRole.mockReset()
    session.resolveSession.mockResolvedValue({ account })
  })

  it('forwards one validated IANA timezone to the authoritative provider', async () => {
    client.progress.mockResolvedValue({ currentStreak: 2 })

    const response = await GET(request('timezone=Asia%2FHo_Chi_Minh'))

    expect(response.status).toBe(200)
    expect(client.progress).toHaveBeenCalledWith(
      'access-token',
      'Asia/Ho_Chi_Minh',
      expect.any(String),
    )
  })

  it('rejects invalid, duplicate, and owner-controlled query values', async () => {
    for (const query of [
      'timezone=Mars%2FOlympus',
      'timezone=UTC&timezone=Asia%2FHo_Chi_Minh',
      'timezone=UTC&ownerId=other',
    ]) {
      const response = await GET(request(query))
      expect(response.status).toBe(400)
    }
    expect(client.progress).not.toHaveBeenCalled()
  })
})
