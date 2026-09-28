import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  appointments: vi.fn(),
  requestAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
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

import { GET, POST as requestAppointment } from './route'
import { POST as cancelAppointment } from './[appointmentId]/cancel/route'

const appointmentId = '10a7e5d8-7960-42fb-9706-e642f849b78f'
const replacementSlotId = '43b7dbb4-021e-4c75-ae48-bfa7126c7256'
const appointment = {
  id: appointmentId,
  slotId: '13b7dbb4-021e-4c75-ae48-bfa7126c7256',
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
  replacedByAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  creditState: 'HELD',
  history: [],
  version: 0,
}

function request(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('Appointment change BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '7fe3a890-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    consultationMocks.appointments.mockResolvedValue({
      data: {
        items: [appointment],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      },
    })
    consultationMocks.requestAppointment.mockResolvedValue({
      data: { ...appointment, id: '20a7e5d8-7960-42fb-9706-e642f849b78f' },
      etag: '"0"',
    })
    consultationMocks.cancelAppointment.mockResolvedValue({
      data: {
        ...appointment,
        status: 'CANCELLED',
        cancelledAt: '2099-09-25T03:00:00Z',
        cancellationReason: 'USER_CANCELLED',
        cancellationActor: 'USER',
        cancellationCreditOutcome: 'RELEASED',
        creditState: 'AVAILABLE',
        version: 1,
      },
      etag: '"1"',
    })
  })

  it('lists appointments through the authenticated user boundary', async () => {
    const response = await GET(request('/api/consultation/appointments'))

    expect(response.status).toBe(200)
    expect(consultationMocks.appointments).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
    )
  })

  it('forwards a replacement with the exact old appointment version', async () => {
    const response = await requestAppointment(
      request(
        '/api/consultation/appointments',
        'POST',
        {
          slotId: replacementSlotId,
          modality: 'IN_APP_CHAT',
          replacesAppointmentId: appointmentId,
        },
        {
          'Idempotency-Key': 'replacement-key-123456',
          'If-Match': '"0"',
        },
      ),
    )

    expect(response.status).toBe(201)
    expect(consultationMocks.requestAppointment).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      {
        slotId: replacementSlotId,
        modality: 'IN_APP_CHAT',
        replacesAppointmentId: appointmentId,
      },
      'replacement-key-123456',
      '"0"',
    )
  })

  it('rejects a replacement without If-Match before calling the provider', async () => {
    const response = await requestAppointment(
      request(
        '/api/consultation/appointments',
        'POST',
        {
          slotId: replacementSlotId,
          modality: 'IN_APP_CHAT',
          replacesAppointmentId: appointmentId,
        },
        { 'Idempotency-Key': 'replacement-key-123456' },
      ),
    )

    expect(response.status).toBe(428)
    expect(consultationMocks.requestAppointment).not.toHaveBeenCalled()
  })

  it('forwards cancellation version and idempotency without an owner override', async () => {
    const response = await cancelAppointment(
      request(
        `/api/consultation/appointments/${appointmentId}/cancel`,
        'POST',
        undefined,
        {
          'Idempotency-Key': 'cancel-command-123456',
          'If-Match': '"0"',
        },
      ),
      { params: Promise.resolve({ appointmentId }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(consultationMocks.cancelAppointment).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      appointmentId,
      '"0"',
      'cancel-command-123456',
    )
  })

  it('rejects cancellation without concurrency evidence', async () => {
    const response = await cancelAppointment(
      request(
        `/api/consultation/appointments/${appointmentId}/cancel`,
        'POST',
        undefined,
        { 'Idempotency-Key': 'cancel-command-123456' },
      ),
      { params: Promise.resolve({ appointmentId }) },
    )

    expect(response.status).toBe(428)
    expect(consultationMocks.cancelAppointment).not.toHaveBeenCalled()
  })
})
