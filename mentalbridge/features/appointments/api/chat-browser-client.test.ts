import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chatEligibility,
  removeChatMessage,
  reportChatMessage,
} from './chat-browser-client'

const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), post: vi.fn() }))

vi.mock('@/lib/api/browser-client', () => ({
  browserApiClient: api,
}))

const appointmentId = '10a7e5d8-7960-42fb-9706-e642f849b78f'
const decision = {
  conversationId: appointmentId,
  appointmentId,
  userAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  specialistAccountId: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
  phase: 'ACTIVE',
  reasonCode: 'APPOINTMENT_ACTIVE',
  subscribeAllowed: true,
  sendAllowed: true,
  historyAllowed: true,
  checkInAllowed: true,
  participantCheckedIn: false,
  sessionOutcome: null,
  creditState: 'HELD',
  scheduledStartAt: '2099-09-27T02:00:00Z',
  scheduledEndAt: '2099-09-27T03:00:00Z',
  serverTime: '2099-09-27T02:05:00Z',
}

describe('chat browser client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: decision })
  })

  it('maps the transport check-in operation to the backend enum', async () => {
    await expect(chatEligibility(appointmentId, 'check-in')).resolves.toEqual(
      decision,
    )

    expect(api.get).toHaveBeenCalledWith(
      `/consultation/appointments/${appointmentId}/chat-eligibility`,
      { params: { operation: 'CHECK_IN' } },
    )
  })

  it('forwards idempotent delete and report commands without inferring their result', async () => {
    const messageId = '13a7e5d8-7960-42fb-9706-e642f849b78f'
    const idempotencyKey = 'mb-694-browser-0001'
    const tombstone = {
      messageId,
      state: 'DELETED',
      deletedAt: '2026-11-11T10:00:00Z',
      duplicate: false,
    }
    const receipt = {
      reportId: '23a7e5d8-7960-42fb-9706-e642f849b78f',
      state: 'OPEN',
      duplicate: false,
    }
    api.delete.mockResolvedValue({ data: tombstone })
    api.post.mockResolvedValue({ data: receipt })

    await expect(
      removeChatMessage(appointmentId, messageId, idempotencyKey),
    ).resolves.toEqual(tombstone)
    await expect(
      reportChatMessage(appointmentId, messageId, idempotencyKey, 'HARASSMENT'),
    ).resolves.toEqual(receipt)

    expect(api.delete).toHaveBeenCalledWith(
      `/realtime/conversations/${appointmentId}/messages/${messageId}`,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
    expect(api.post).toHaveBeenCalledWith(
      `/realtime/conversations/${appointmentId}/messages/${messageId}/reports`,
      { reason: 'HARASSMENT' },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  })
})
