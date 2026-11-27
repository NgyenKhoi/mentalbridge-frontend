import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const consultationMocks = vi.hoisted(() => ({
  participantAppointmentDispute: vi.fn(),
  openAppointmentDispute: vi.fn(),
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

import { POST as openUser } from './[appointmentId]/dispute/route'

const appointmentId = '10a7e5d8-7960-42fb-9706-e642f849b78f'
const disputeId = '40a7e5d8-7960-42fb-9706-e642f849b78f'
const dispute = {
  id: disputeId,
  appointmentId,
  appointmentVersion: 4,
  status: 'OPEN',
  openedByRole: 'USER',
  reasonCode: 'OUTCOME_INCORRECT',
  evidenceType: null,
  evidenceOccurredAt: null,
  openedAt: '2099-09-27T04:00:00Z',
  eligibleUntil: '2099-09-28T04:00:00Z',
  settlementGated: true,
  resolutionOutcome: null,
  resolutionReason: null,
  resolvedAt: null,
  priorAppointmentStatus: null,
  priorSessionOutcome: null,
  resultingAppointmentStatus: null,
  resultingSessionOutcome: null,
  creditAction: null,
  version: 0,
}

function request(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  headers = {},
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

describe('appointment dispute BFF routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      accessToken: 'access-token',
      account: {
        accountId: 'actor',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    consultationMocks.openAppointmentDispute.mockResolvedValue({
      data: dispute,
      etag: null,
    })
  })

  it('forwards one exact metadata-only USER command and stable key', async () => {
    const response = await openUser(
      request(
        `/api/consultation/appointments/${appointmentId}/dispute`,
        'POST',
        { reasonCode: 'OUTCOME_INCORRECT' },
        { 'Idempotency-Key': 'dispute-browser-key-0001' },
      ),
      { params: Promise.resolve({ appointmentId }) },
    )
    expect(response.status).toBe(200)
    expect(consultationMocks.openAppointmentDispute).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      appointmentId,
      'USER',
      {
        reasonCode: 'OUTCOME_INCORRECT',
        evidenceType: null,
        evidenceOccurredAt: null,
      },
      'dispute-browser-key-0001',
    )
  })

  it('rejects free text before calling Consultation', async () => {
    const response = await openUser(
      request(
        `/api/consultation/appointments/${appointmentId}/dispute`,
        'POST',
        { reasonCode: 'OUTCOME_INCORRECT', notes: 'private content' },
        { 'Idempotency-Key': 'dispute-browser-key-0002' },
      ),
      { params: Promise.resolve({ appointmentId }) },
    )
    expect(response.status).toBe(400)
    expect(consultationMocks.openAppointmentDispute).not.toHaveBeenCalled()
  })
})
