import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ConsultationServiceError } from '@/lib/consultation/consultation-client'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  specialistReusableSessionSummaries: vi.fn(),
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

const appointmentId = '89100000-0000-4000-8000-000000000001'
const call = (id = appointmentId) =>
  GET(
    new NextRequest(
      `http://localhost/api/consultation/specialist/appointments/${id}/reusable-session-summaries`,
      { headers: { cookie: 'mentalbridge_access=old-token' } },
    ),
    { params: Promise.resolve({ appointmentId: id }) },
  )

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolveSession.mockResolvedValue({
    account: { roles: ['SPECIALIST'], status: 'ACTIVE' },
  })
  mocks.specialistReusableSessionSummaries.mockResolvedValue({
    data: { items: [], count: 0, generatedAt: '2026-11-18T13:00:00Z' },
  })
})

it('reads approved earlier summaries for the specialist of the appointment', async () => {
  const response = await call()
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(mocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
    'SPECIALIST',
  ])
  expect(mocks.specialistReusableSessionSummaries).toHaveBeenCalledWith(
    'old-token',
    expect.any(String),
    appointmentId,
  )
})

it('refuses other roles and malformed ids before the provider', async () => {
  mocks.ensureRole.mockImplementationOnce(() => {
    throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'No.' })
  })
  expect((await call()).status).toBe(403)
  expect((await call('not-a-uuid')).status).toBe(400)
  expect(mocks.specialistReusableSessionSummaries).not.toHaveBeenCalled()
})

it('keeps the eligibility code and hides provider details', async () => {
  mocks.specialistReusableSessionSummaries.mockRejectedValueOnce(
    new ConsultationServiceError(
      403,
      'SESSION_SUMMARY_REUSE_NOT_ELIGIBLE',
      'Không đủ điều kiện.',
    ),
  )
  const refused = await call()
  expect(refused.status).toBe(403)
  expect(((await refused.json()) as { code: string }).code).toBe(
    'SESSION_SUMMARY_REUSE_NOT_ELIGIBLE',
  )
  mocks.specialistReusableSessionSummaries.mockRejectedValueOnce(
    new Error('private-secret'),
  )
  const failed = await call()
  expect(failed.status).toBe(502)
  expect(await failed.text()).not.toContain('private-secret')
})
