import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationServiceError } from '@/lib/consultation/consultation-client'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  closeFailedAdminPayout: vi.fn(),
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: mocks.resolveSession,
  ensureRole: mocks.ensureRole,
}))
vi.mock('@/lib/consultation/consultation-client', async (original) => ({
  ...(await original<
    typeof import('@/lib/consultation/consultation-client')
  >()),
  consultationClient: mocks,
}))

import { POST } from './route'

const payoutId = '78700000-0000-4000-8000-000000000003'
const attemptId = '78700000-0000-4000-8000-000000000004'
const key = 'close-dialog-key-0123456789'
const ok = {
  expectedAttemptId: attemptId,
  reasonCode: 'DESTINATION_UNUSABLE',
}
const params = { params: Promise.resolve({ payoutId }) }
const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest(
      `http://localhost/api/consultation/admin/payouts/${payoutId}/close-failed`,
      {
        method: 'POST',
        headers: {
          cookie: 'mentalbridge_access=old-token',
          'content-type': 'application/json',
          'Idempotency-Key': key,
          ...headers,
        },
        body: JSON.stringify(body),
      },
    ),
    params,
  )

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveSession.mockResolvedValue({
    account: { roles: ['ADMIN'], status: 'ACTIVE' },
  })
  mocks.closeFailedAdminPayout.mockResolvedValue({ data: { payout: {} } })
})

it('closes for admins with the exact attempt id, reason and the caller key', async () => {
  const response = await call(ok)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN'])
  expect(mocks.closeFailedAdminPayout).toHaveBeenCalledWith(
    'old-token',
    expect.any(String),
    payoutId,
    ok,
    key,
  )
})

it('refuses non-admins, missing keys and malformed bodies before the provider', async () => {
  mocks.ensureRole.mockImplementationOnce(() => {
    throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'No.' })
  })
  expect((await call(ok)).status).toBe(403)
  expect((await call(ok, { 'Idempotency-Key': 'x' })).status).toBe(400)
  expect((await call({ ...ok, expectedAttemptId: 'nope' })).status).toBe(422)
  expect((await call({ ...ok, extra: 1 })).status).toBe(422)
  expect((await call({ ...ok, reasonCode: 'OTHER' })).status).toBe(422)
  expect((await call({ expectedAttemptId: attemptId })).status).toBe(422)
  expect(mocks.closeFailedAdminPayout).not.toHaveBeenCalled()
})

it('keeps the safe problem code for not-available and outage answers', async () => {
  mocks.closeFailedAdminPayout.mockRejectedValueOnce(
    new ConsultationServiceError(
      409,
      'PAYOUT_CLOSE_NOT_AVAILABLE',
      'Không thể.',
    ),
  )
  const conflict = await call(ok)
  expect(conflict.status).toBe(409)
  expect(((await conflict.json()) as { code: string }).code).toBe(
    'PAYOUT_CLOSE_NOT_AVAILABLE',
  )
  mocks.closeFailedAdminPayout.mockRejectedValueOnce(
    new Error('private-secret'),
  )
  const failed = await call(ok)
  expect(failed.status).toBe(502)
  expect(await failed.text()).not.toContain('private-secret')
})
