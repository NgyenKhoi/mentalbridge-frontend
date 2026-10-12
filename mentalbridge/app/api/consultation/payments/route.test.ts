import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationServiceError } from '@/lib/consultation/consultation-client'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  planPayments: vi.fn(),
  planPayment: vi.fn(),
  adminPayments: vi.fn(),
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

import { GET as history } from './route'
import { GET as payment } from './[paymentId]/route'
import { GET as admin } from '../admin/payments/route'

const id = '62200000-0000-4000-8000-000000000004'
const request = () =>
  new NextRequest('http://localhost/api/consultation/payments', {
    headers: { cookie: 'mentalbridge_access=old-token' },
  })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveSession.mockResolvedValue({
    account: { roles: ['USER'], status: 'ACTIVE' },
    rotatedTokens: {
      accessToken: 'rotated-test-token',
      refreshToken: 'rotated-test-refresh',
      expiresIn: 300,
      refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  })
  mocks.planPayments.mockResolvedValue({ data: { items: [], count: 0 } })
  mocks.planPayment.mockResolvedValue({ data: { paymentId: id } })
  mocks.adminPayments.mockResolvedValue({ data: { items: [], count: 0 } })
})

it('keeps owner history private and forwards only the rotated credential', async () => {
  const response = await history(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.cookies.get('mentalbridge_access')?.value).toBe(
    'rotated-test-token',
  )
  expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), ['USER'])
  expect(mocks.planPayments).toHaveBeenCalledWith(
    'rotated-test-token',
    expect.any(String),
  )
  expect(await response.text()).not.toContain('token')
})

it('authorizes the canonical admin read before contacting its provider', async () => {
  mocks.ensureRole.mockImplementation(() => {
    throw new ApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Not allowed.',
    })
  })
  const response = await admin(request())
  expect(response.status).toBe(403)
  expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN'])
  expect(mocks.adminPayments).not.toHaveBeenCalled()
})

it('rejects unauthenticated owner reads and clears expired credentials', async () => {
  mocks.resolveSession.mockRejectedValue(
    new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Expired.' }),
  )
  const response = await history(request())
  expect(response.status).toBe(401)
  expect(response.cookies.get('mentalbridge_access')?.value).toBe('')
  expect(mocks.planPayments).not.toHaveBeenCalled()
})

it('validates payment identity and carries refreshed cookies on local errors', async () => {
  const response = await payment(request(), {
    params: Promise.resolve({ paymentId: 'not-a-payment' }),
  })
  expect(response.status).toBe(400)
  expect(response.cookies.get('mentalbridge_access')?.value).toBe(
    'rotated-test-token',
  )
  expect(mocks.planPayment).not.toHaveBeenCalled()
})

it('preserves owner not-found without revealing a different account', async () => {
  mocks.planPayment.mockRejectedValue(
    new ConsultationServiceError(404, 'PAYMENT_NOT_FOUND', 'Not found.'),
  )
  const response = await payment(request(), {
    params: Promise.resolve({ paymentId: id }),
  })
  expect(response.status).toBe(404)
  expect(mocks.planPayment).toHaveBeenCalledWith(
    'rotated-test-token',
    expect.any(String),
    id,
  )
})

it('fails closed on dependency failure without leaking transport details', async () => {
  mocks.adminPayments.mockRejectedValue(new Error('private-provider-secret'))
  const response = await admin(request())
  expect(response.status).toBe(502)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.text()).not.toContain('private-provider-secret')
})
