import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationServiceError } from '@/lib/consultation/consultation-client'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  specialistPayoutBanks: vi.fn(),
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

import { GET } from './route'

const request = () =>
  new NextRequest('http://localhost/api/consultation/specialist/payout-banks', {
    headers: { cookie: 'mentalbridge_access=old-token' },
  })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveSession.mockResolvedValue({
    account: { roles: ['SPECIALIST'], status: 'ACTIVE' },
  })
  mocks.specialistPayoutBanks.mockResolvedValue({
    data: { generatedAt: '2026-11-04T03:00:00Z', items: [] },
  })
})

it('serves the bank list to specialists only', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
    'SPECIALIST',
  ])
  expect(mocks.specialistPayoutBanks).toHaveBeenCalledWith(
    'old-token',
    expect.any(String),
  )
})

it('refuses other roles before any provider call', async () => {
  mocks.ensureRole.mockImplementation(() => {
    throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'No.' })
  })
  expect((await GET(request())).status).toBe(403)
  expect(mocks.specialistPayoutBanks).not.toHaveBeenCalled()
})

it('keeps the 503 bank-list code so the form can offer a retry', async () => {
  mocks.specialistPayoutBanks.mockRejectedValue(
    new ConsultationServiceError(
      503,
      'PAYOUT_BANK_LIST_UNAVAILABLE',
      'Chưa tải được.',
    ),
  )
  const response = await GET(request())
  expect(response.status).toBe(503)
  expect(((await response.json()) as { code: string }).code).toBe(
    'PAYOUT_BANK_LIST_UNAVAILABLE',
  )
})
