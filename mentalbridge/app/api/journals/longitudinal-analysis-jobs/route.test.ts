import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const journal = vi.hoisted(() => ({ createLongitudinalAnalysis: vi.fn() }))
const session = vi.hoisted(() => ({ resolveSession: vi.fn() }))
vi.mock('@/lib/journal/journal-client', () => ({ journalClient: journal }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: session.resolveSession,
  ensureRole: vi.fn(),
}))

import { POST } from './route'

const body = {
  previousPeriod: {
    startAt: '2026-08-27T00:00:00Z',
    endAt: '2026-09-10T00:00:00Z',
  },
  currentPeriod: {
    startAt: '2026-09-10T00:00:00Z',
    endAt: '2026-09-24T00:00:00Z',
  },
  excludedJournalIds: [],
}

function request(value: unknown, key = 'longitudinal-browser-0001') {
  return new NextRequest(
    'http://localhost/api/journals/longitudinal-analysis-jobs',
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=access-token`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify(value),
    },
  )
}

describe('/api/journals/longitudinal-analysis-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.resolveSession.mockResolvedValue({
      account: { accountId: 'owner', roles: ['USER'] },
    })
  })

  it('forwards the exact Care-issued periods to Journal', async () => {
    journal.createLongitudinalAnalysis.mockResolvedValue({ jobId: 'job' })
    const response = await POST(request(body))
    expect(response.status).toBe(202)
    expect(journal.createLongitudinalAnalysis).toHaveBeenCalledWith(
      'access-token',
      body,
      'longitudinal-browser-0001',
      expect.any(String),
    )
  })

  it('rejects malformed periods before calling Journal', async () => {
    const response = await POST(
      request({ ...body, currentPeriod: { startAt: 'bad', endAt: 'bad' } }),
    )
    expect(response.status).toBe(400)
    expect(journal.createLongitudinalAnalysis).not.toHaveBeenCalled()
  })
})
