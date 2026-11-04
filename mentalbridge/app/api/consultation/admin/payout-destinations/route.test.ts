import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationServiceError } from '@/lib/consultation/consultation-client'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  adminPayoutDestinations: vi.fn(),
  adminPayoutDestinationDetail: vi.fn(),
  confirmAdminPayoutDestination: vi.fn(),
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

import { GET as list } from './route'
import { GET as detail } from './[destinationId]/route'
import { POST as confirm } from './[destinationId]/confirm/route'

const id = '78700000-0000-4000-8000-000000000001'
const key = 'dialog-open-key-0123456789'
const path = '/api/consultation/admin/payout-destinations'
const cookie = { cookie: 'mentalbridge_access=old-token' }
const params = { params: Promise.resolve({ destinationId: id }) }
const confirmRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}/${id}/confirm`, {
    method: 'POST',
    headers: {
      ...cookie,
      'content-type': 'application/json',
      'Idempotency-Key': key,
      ...headers,
    },
    body: JSON.stringify(body),
  })
const validBody = { expectedVersion: 0, reasonCode: 'ACCOUNT_HOLDER_CHECKED' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveSession.mockResolvedValue({
    account: { roles: ['ADMIN'], status: 'ACTIVE' },
  })
  mocks.adminPayoutDestinations.mockResolvedValue({
    data: { items: [], count: 0 },
  })
  mocks.adminPayoutDestinationDetail.mockResolvedValue({ data: { id } })
  mocks.confirmAdminPayoutDestination.mockResolvedValue({ data: { id } })
})

it('lists the queue for admins only, forwarding the query and never caching', async () => {
  const response = await list(
    new NextRequest(`http://localhost${path}?status=PENDING_CONFIRMATION`, {
      headers: cookie,
    }),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN'])
  expect(mocks.adminPayoutDestinations).toHaveBeenCalledWith(
    'old-token',
    expect.any(String),
    '?status=PENDING_CONFIRMATION',
  )
})

it('refuses non-admin callers before any provider call', async () => {
  mocks.ensureRole.mockImplementation(() => {
    throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'No.' })
  })
  expect(
    (
      await list(
        new NextRequest(`http://localhost${path}`, { headers: cookie }),
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await detail(
        new NextRequest(`http://localhost${path}/${id}`, { headers: cookie }),
        params,
      )
    ).status,
  ).toBe(403)
  expect((await confirm(confirmRequest(validBody), params)).status).toBe(403)
  expect(mocks.adminPayoutDestinations).not.toHaveBeenCalled()
  expect(mocks.adminPayoutDestinationDetail).not.toHaveBeenCalled()
  expect(mocks.confirmAdminPayoutDestination).not.toHaveBeenCalled()
})

it('serves exact detail with no-store and maps a missing destination to 404', async () => {
  const ok = await detail(
    new NextRequest(`http://localhost${path}/${id}`, { headers: cookie }),
    params,
  )
  expect(ok.status).toBe(200)
  expect(ok.headers.get('Cache-Control')).toBe('no-store')
  mocks.adminPayoutDestinationDetail.mockRejectedValue(
    new ConsultationServiceError(404, 'NOT_FOUND', 'Không tìm thấy.'),
  )
  const missing = await detail(
    new NextRequest(`http://localhost${path}/${id}`, { headers: cookie }),
    params,
  )
  expect(missing.status).toBe(404)
})

it('requires a valid Idempotency-Key and a strict body to confirm', async () => {
  const noKey = await confirm(
    new NextRequest(`http://localhost${path}/${id}/confirm`, {
      method: 'POST',
      headers: { ...cookie, 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }),
    params,
  )
  expect(noKey.status).toBe(400)
  const badBody = await confirm(
    confirmRequest({ expectedVersion: 0, reasonCode: 'OTHER' }),
    params,
  )
  expect(badBody.status).toBe(422)
  expect(mocks.confirmAdminPayoutDestination).not.toHaveBeenCalled()
})

it('passes the same key and body through on confirm, and keeps the version conflict code', async () => {
  const ok = await confirm(confirmRequest(validBody), params)
  expect(ok.status).toBe(200)
  expect(mocks.confirmAdminPayoutDestination).toHaveBeenCalledWith(
    'old-token',
    expect.any(String),
    id,
    validBody,
    key,
  )
  mocks.confirmAdminPayoutDestination.mockRejectedValue(
    new ConsultationServiceError(
      409,
      'PAYOUT_DESTINATION_VERSION_CONFLICT',
      'Đã thay đổi.',
    ),
  )
  const conflict = await confirm(confirmRequest(validBody), params)
  expect(conflict.status).toBe(409)
  expect(((await conflict.json()) as { code: string }).code).toBe(
    'PAYOUT_DESTINATION_VERSION_CONFLICT',
  )
})

it('does not leak transport details on dependency failure', async () => {
  mocks.confirmAdminPayoutDestination.mockRejectedValue(
    new Error('private-provider-secret'),
  )
  const response = await confirm(confirmRequest(validBody), params)
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain('private-provider-secret')
})
