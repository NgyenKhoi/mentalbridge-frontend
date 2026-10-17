import { beforeEach, describe, expect, it, vi } from 'vitest'

import { videoBrowserClient } from './video-browser-client'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({ browserApiClient: client }))

const id = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const session = {
  appointmentId: id,
  phase: 'ACTIVE',
  previewAllowed: true,
  joinAllowed: true,
  startsAt: '2026-10-12T10:00:00Z',
  endsAt: '2026-10-12T11:00:00Z',
  serverTime: '2026-10-12T10:01:00Z',
  version: 2,
  completion: null,
}
const access = {
  appointmentId: id,
  provider: 'LIVEKIT',
  serverUrl: 'wss://synthetic-project.livekit.cloud',
  roomName: `mb-${id}`,
  participantToken: 'synthetic.fixture.signature',
  expiresAt: '2026-10-12T10:03:00Z',
  endsAt: session.endsAt,
}
const completion = {
  appointmentId: id,
  confirmationId: otherId,
  verificationState: 'PENDING_VERIFICATION',
  appointmentStatus: 'SESSION_ENDED',
  creditState: 'HELD',
  completionFactId: null,
  acceptedAt: '2026-10-12T10:05:00Z',
  manualReviewAt: '2026-10-13T10:05:00Z',
  version: 3,
}

describe('video browser owner boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retrieves only appointment-scoped connection data with no actor or room authority', async () => {
    client.get.mockResolvedValue({ data: session })
    client.post.mockResolvedValue({ data: access })
    expect(await videoBrowserClient.session(id)).toEqual(session)
    expect(await videoBrowserClient.access(id)).toEqual(access)
    expect(client.get).toHaveBeenCalledWith(
      `/consultation/appointments/${id}/video-session`,
    )
    expect(client.post).toHaveBeenCalledWith(
      `/consultation/appointments/${id}/video-access`,
    )
  })

  it('preserves explicit intent, revision and the same replay key without inventing completion', async () => {
    client.post.mockResolvedValue({ data: completion })
    for (let attempt = 0; attempt < 2; attempt++)
      expect(await videoBrowserClient.complete(id, 2, otherId)).toEqual(
        completion,
      )
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      `/consultation/specialist/appointments/${id}/video-completion`,
      { confirmation: 'CONSULTATION_FINISHED' },
      { headers: { 'If-Match': '"2"', 'Idempotency-Key': otherId } },
    )
  })

  it('rejects cross-appointment session, access and completion responses', async () => {
    client.get.mockResolvedValue({
      data: { ...session, appointmentId: otherId },
    })
    await expect(videoBrowserClient.session(id)).rejects.toThrow(
      'Video session unavailable.',
    )
    client.post.mockResolvedValue({
      data: { ...access, appointmentId: otherId },
    })
    await expect(videoBrowserClient.access(id)).rejects.toThrow(
      'Video access unavailable.',
    )
    client.post.mockResolvedValue({
      data: { ...completion, appointmentId: otherId },
    })
    await expect(videoBrowserClient.complete(id, 2, otherId)).rejects.toThrow(
      'Video confirmation unavailable.',
    )
  })

  it('does not include sensitive received fields in malformed-response errors', async () => {
    client.post.mockResolvedValue({
      data: { ...access, apiSecret: 'never-render-this-value' },
    })
    await expect(videoBrowserClient.access(id)).rejects.toThrow(
      /^Video access unavailable\.$/,
    )
    client.post.mockResolvedValue({
      data: { ...completion, creditState: 'AVAILABLE' },
    })
    await expect(videoBrowserClient.complete(id, 2, otherId)).rejects.toThrow(
      'Video confirmation unavailable.',
    )
  })
})
