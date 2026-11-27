import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/admin/platform-report-schedules/route'
import {
  PUT,
  DELETE,
} from '@/app/api/admin/platform-report-schedules/[scheduleId]/route'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const id = 'a2464b2b-a7fd-46fd-9310-64ef4eac7de7'
const body = {
  reportType: 'ACCOUNT_ACTIVITY',
  cadence: 'DAILY',
  timezone: 'Asia/Ho_Chi_Minh',
  localTime: '08:00',
  periodDays: 7,
  recipientGroup: 'ADMIN',
  deliveryTarget: 'ADMIN_REPORT_HISTORY',
  enabled: true,
}
const schedule = {
  ...body,
  scheduleId: id,
  status: 'ACTIVE',
  nextRunAt: '2026-10-12T01:00:00Z',
  lastFailureCode: null,
  createdAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
  version: 0,
}
const account = {
  accountId: id,
  email: 'admin@synthetic.invalid',
  status: 'ACTIVE',
  roles: ['ADMIN'],
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  version: 1,
}
const context = { params: Promise.resolve({ scheduleId: id }) }
function json(value: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function request(
  method = 'GET',
  value?: unknown,
  suffix = '',
  origin = 'http://localhost',
) {
  return new NextRequest(
    `http://localhost/api/admin/platform-report-schedules${suffix}`,
    {
      method,
      headers: {
        Host: 'localhost',
        Origin: origin,
        Cookie: `${ACCESS_COOKIE_NAME}=synthetic-access`,
        'Content-Type': 'application/json',
      },
      ...(value ? { body: JSON.stringify(value) } : {}),
    },
  )
}
beforeEach(() => {
  vi.stubEnv('IDENTITY_API_BASE_URL', 'http://identity.test')
  vi.stubEnv('IDENTITY_API_TIMEOUT_MS', '1000')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('report schedules BFF', () => {
  it('validates owner responses and strips unapproved payload fields', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json([{ ...schedule, rawJournal: 'private' }]))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('private')
  })
  it('creates and updates approved schedules through exact owner paths', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json(schedule, 201))
    expect((await POST(request('POST', body))).status).toBe(201)
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json(schedule))
    expect(
      (await PUT(request('PUT', body, `/${id}?expectedVersion=0`), context))
        .status,
    ).toBe(200)
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toContain(
      `/api/v1/admin/platform-report-schedules/${id}?expectedVersion=0`,
    )
  })
  it('deletes without a response body', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json(null, 204))
    const response = await DELETE(
      request('DELETE', undefined, `/${id}?expectedVersion=0`),
      context,
    )
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })
  it('rejects cross-origin, arbitrary delivery, invalid versions and non-admin roles', async () => {
    expect(
      (await POST(request('POST', body, '', 'http://evil.test'))).status,
    ).toBe(403)
    expect(
      (await POST(request('POST', { ...body, deliveryTarget: 'EMAIL' })))
        .status,
    ).toBe(400)
    expect(
      (
        await DELETE(
          request('DELETE', undefined, `/${id}?expectedVersion=-1`),
          context,
        )
      ).status,
    ).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ ...account, roles: ['USER'] }),
    )
    expect((await GET(request())).status).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('fails closed on malformed owner data and transport failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json([{ ...schedule, recipientGroup: 'USER' }]))
    expect((await GET(request())).status).toBe(502)
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(account))
      .mockRejectedValueOnce(new Error('synthetic transport failure'))
    expect((await GET(request())).status).toBe(503)
  })
})
