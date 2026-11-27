import { create } from 'axios'

import { createVideoApi } from './video-api'

const id = '11111111-1111-4111-8111-111111111111'
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
  confirmationId: id,
  verificationState: 'PENDING_VERIFICATION',
  appointmentStatus: 'SESSION_ENDED',
  creditState: 'HELD',
  completionFactId: null,
  acceptedAt: '2026-10-12T10:05:00Z',
  manualReviewAt: '2026-10-13T10:05:00Z',
  version: 3,
}

describe('MB-384 mobile video API', () => {
  it('uses owner endpoints and never sends actor, room or provider authority', async () => {
    const client = create()
    const get = jest.spyOn(client, 'get').mockResolvedValue({ data: session })
    const post = jest.spyOn(client, 'post').mockResolvedValue({ data: access })
    const api = createVideoApi(client)
    await expect(api.session(id)).resolves.toEqual(session)
    expect(get).toHaveBeenCalledWith(`/api/v1/appointments/${id}/video-session`)
    await expect(api.access(id)).resolves.toEqual(access)
    expect(post).toHaveBeenCalledWith(`/api/v1/appointments/${id}/video-access`)
    post.mockResolvedValue({ data: completion })
    await api.complete(id, 2, 'video-confirmation-synthetic')
    expect(post).toHaveBeenLastCalledWith(
      `/api/v1/specialist/appointments/${id}/video-completion`,
      { confirmation: 'CONSULTATION_FINISHED' },
      {
        headers: {
          'If-Match': '"2"',
          'Idempotency-Key': 'video-confirmation-synthetic',
        },
      },
    )
    await expect(
      api.complete(id, -1, 'video-confirmation-synthetic'),
    ).rejects.toThrow()
    expect(post).toHaveBeenCalledTimes(2)
  })
  it('fails closed for cross-appointment or malformed provider responses without leaking tokens', async () => {
    const client = create()
    const post = jest.spyOn(client, 'post').mockResolvedValue({
      data: {
        ...access,
        appointmentId: '22222222-2222-4222-8222-222222222222',
      },
    })
    const api = createVideoApi(client)
    await expect(api.access(id)).rejects.toMatchObject({
      code: 'VIDEO_CONTRACT_MISMATCH',
    })
    post.mockResolvedValue({ data: { ...access, apiSecret: 'must-not-leak' } })
    try {
      await api.access(id)
      throw new Error('Expected contract rejection')
    } catch (error) {
      expect(error).toMatchObject({ code: 'VIDEO_CONTRACT_MISMATCH' })
      expect(JSON.stringify(error)).not.toMatch(
        /must-not-leak|synthetic\.fixture\.signature/,
      )
    }
  })
})
