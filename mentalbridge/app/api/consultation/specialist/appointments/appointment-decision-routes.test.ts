import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  assignedAppointments: vi.fn(),
  decideAppointment: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultationMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'
import { POST } from './[appointmentId]/[decision]/route'

const appointmentId = '10a7e5d8-7960-42fb-9706-e642f849b78f'
const appointment = {
  id: appointmentId,
  slotId: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  specialistDisplayName: 'Chuyên gia An',
  status: 'REQUESTED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2099-09-27T02:00:00Z',
  scheduledEndAt: '2099-09-27T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-09-25T02:00:00Z',
  decisionDeadlineAt: '2099-09-26T02:00:00Z',
  heldCreditId: '96de7b84-14ae-46cd-bfa1-8314d1366b02',
  replacesAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  creditState: 'HELD',
  version: 0,
}

function request(
  path: string,
  method = 'GET',
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...headers,
    },
  })
}

describe('Specialist appointment decision BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['SPECIALIST'],
        emailVerified: true,
      },
    })
    consultationMocks.assignedAppointments.mockResolvedValue({
      data: {
        items: [appointment],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      },
    })
    consultationMocks.decideAppointment.mockResolvedValue({
      data: { ...appointment, status: 'CONFIRMED', version: 1 },
      etag: '"1"',
    })
  })

  it('lists only through the specialist-authenticated boundary', async () => {
    const response = await GET(
      request('/api/consultation/specialist/appointments'),
    )

    expect(response.status).toBe(200)
    expect(consultationMocks.assignedAppointments).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
    )
  })

  it('forwards a validated decision with version and idempotency', async () => {
    const response = await POST(
      request(
        `/api/consultation/specialist/appointments/${appointmentId}/accept`,
        'POST',
        { 'If-Match': '"0"', 'Idempotency-Key': 'decision-key-123456' },
      ),
      {
        params: Promise.resolve({ appointmentId, decision: 'accept' }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(consultationMocks.decideAppointment).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      appointmentId,
      'accept',
      '"0"',
      'decision-key-123456',
    )
  })

  it('rejects malformed commands before calling consultation', async () => {
    const response = await POST(
      request(
        `/api/consultation/specialist/appointments/${appointmentId}/accept`,
        'POST',
      ),
      {
        params: Promise.resolve({ appointmentId, decision: 'accept' }),
      },
    )

    expect(response.status).toBe(400)
    expect(consultationMocks.decideAppointment).not.toHaveBeenCalled()
  })
})
