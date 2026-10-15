import {
  videoAccessSchema,
  videoCompletionSchema,
  videoSessionSchema,
} from './video-contract'

const id = '11111111-1111-4111-8111-111111111111'
const completion = {
  appointmentId: id,
  confirmationId: '22222222-2222-4222-8222-222222222222',
  verificationState: 'PENDING_VERIFICATION',
  appointmentStatus: 'SESSION_ENDED',
  creditState: 'HELD',
  completionFactId: null,
  acceptedAt: '2026-10-12T10:05:00Z',
  manualReviewAt: '2026-10-13T10:05:00Z',
  version: 3,
}
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

describe('MB-384 public video contracts', () => {
  it.each([
    'TOO_EARLY',
    'WAITING',
    'ACTIVE',
    'ENDED',
    'COMPLETED',
    'NOT_AVAILABLE',
    'UNAVAILABLE',
  ])('accepts only matching %s flags', (phase) => {
    const value = {
      ...session,
      phase,
      joinAllowed: phase === 'ACTIVE',
      previewAllowed: ['WAITING', 'ACTIVE'].includes(phase),
    }
    expect(videoSessionSchema.parse(value)).toEqual(value)
    expect(
      videoSessionSchema.safeParse({
        ...value,
        joinAllowed: !value.joinAllowed,
      }).success,
    ).toBe(false)
  })
  it('keeps pending/review held and requires an authoritative fact for completed', () => {
    expect(videoCompletionSchema.parse(completion)).toEqual(completion)
    expect(
      videoCompletionSchema.safeParse({
        ...completion,
        verificationState: 'EVIDENCE_REVIEW',
      }).success,
    ).toBe(true)
    expect(
      videoCompletionSchema.safeParse({
        ...completion,
        creditState: 'AVAILABLE',
      }).success,
    ).toBe(false)
    const verified = {
      ...completion,
      verificationState: 'VERIFIED',
      appointmentStatus: 'COMPLETED',
      creditState: 'CONSUMED',
      completionFactId: id,
    }
    expect(videoCompletionSchema.parse(verified)).toEqual(verified)
    expect(
      videoCompletionSchema.safeParse({ ...verified, completionFactId: null })
        .success,
    ).toBe(false)
  })
  it('rejects cross-session completion, secrets, non-Cloud or leaking URLs', () => {
    expect(videoAccessSchema.parse(access)).toEqual(access)
    for (const serverUrl of [
      'ws://synthetic.livekit.cloud',
      'wss://evil.example',
      'wss://p.livekit.cloud.evil.example',
      'wss://p.livekit.cloud?token=hidden',
      'wss://name:secret@p.livekit.cloud',
    ])
      expect(
        videoAccessSchema.safeParse({ ...access, serverUrl }).success,
      ).toBe(false)
    expect(
      videoAccessSchema.safeParse({ ...access, apiSecret: 'synthetic' })
        .success,
    ).toBe(false)
    expect(
      videoSessionSchema.safeParse({ ...session, completion }).success,
    ).toBe(false)
    expect(
      videoSessionSchema.safeParse({
        ...session,
        phase: 'ENDED',
        joinAllowed: false,
        previewAllowed: false,
        version: 3,
        completion,
      }).success,
    ).toBe(true)
  })
})
