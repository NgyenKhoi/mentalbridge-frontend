import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  discoverSpecialists: vi.fn(),
  discoveredSpecialist: vi.fn(),
}))
const actorMocks = vi.hoisted(() => ({
  authenticatedConsultationActor: vi.fn(),
  carryConsultationSession: vi.fn((response) => response),
  consultationAuthenticationFailure: vi.fn(),
}))

vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultationMocks,
}))
vi.mock('@/lib/consultation/authenticated-actor', () => actorMocks)

import { GET as list } from './route'
import { GET as detail } from './[specialistId]/route'

const specialistId = '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8'

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
  })
}

describe('Specialist discovery BFF', () => {
  beforeEach(() => {
    Object.values(consultationMocks).forEach((mock) => mock.mockReset())
    actorMocks.authenticatedConsultationActor.mockReset()
    actorMocks.authenticatedConsultationActor.mockResolvedValue({
      accessToken: 'access-token',
      account: { roles: ['USER'] },
    })
    consultationMocks.discoverSpecialists.mockResolvedValue({
      data: { items: [], count: 0 },
    })
    consultationMocks.discoveredSpecialist.mockResolvedValue({
      data: { specialistAccountId: specialistId },
    })
  })

  it('requires USER and forwards only validated list filters', async () => {
    const response = await list(
      request(
        '/api/consultation/specialists?language=vi&timezone=Asia%2FHo_Chi_Minh',
      ),
    )

    expect(response.status).toBe(200)
    expect(actorMocks.authenticatedConsultationActor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      ['USER'],
    )
    expect(consultationMocks.discoverSpecialists).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      '?language=vi&timezone=Asia%2FHo_Chi_Minh',
    )
    expect(JSON.stringify(await response.json())).not.toContain('access-token')
  })

  it('forwards detail by exact specialist id without re-deriving eligibility', async () => {
    const response = await detail(
      request(
        `/api/consultation/specialists/${specialistId}?modality=IN_APP_CHAT`,
      ),
      { params: Promise.resolve({ specialistId }) },
    )

    expect(response.status).toBe(200)
    expect(consultationMocks.discoveredSpecialist).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      specialistId,
      '?modality=IN_APP_CHAT',
    )
  })

  it('rejects unknown, duplicated, and invalid detail inputs locally', async () => {
    const unknown = await list(
      request('/api/consultation/specialists?phone=true'),
    )
    const duplicate = await list(
      request('/api/consultation/specialists?language=vi&language=en'),
    )
    const invalidDetail = await detail(
      request('/api/consultation/specialists/not-a-uuid'),
      { params: Promise.resolve({ specialistId: 'not-a-uuid' }) },
    )

    expect([unknown.status, duplicate.status, invalidDetail.status]).toEqual([
      400, 400, 400,
    ])
    expect(consultationMocks.discoverSpecialists).not.toHaveBeenCalled()
    expect(consultationMocks.discoveredSpecialist).not.toHaveBeenCalled()
  })
})
